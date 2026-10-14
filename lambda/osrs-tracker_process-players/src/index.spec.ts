import { SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs';
import { HiscoreResult } from '@osrs-tracker/hiscores';
import { PlayerScrapeMessageBody } from '@osrs-tracker/models';
import { Context, SQSEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessageBatch } from '@lambda/shared/sqs.utils';
import { handler } from './index';
import { discordAlert } from './utils/discord-alert';
import { MU } from './utils/mongo.utils';
import { fetchHiscore } from './utils/player.utils';

// the staggered hiscore requests wait 2 s per player
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => {}) }));
vi.mock('./utils/player.utils', () => ({ fetchHiscore: vi.fn() }));
vi.mock('./utils/mongo.utils', () => ({
  MU: {
    client: vi.fn(),
    ensureHiscoreLayouts: vi.fn(),
    hiscoreEntryBulkWriteOp: vi.fn((username: string) => ({ updateOne: { filter: { username }, update: [] } })),
    recordHiscoreNotFound: vi.fn(),
    bulkWrite: vi.fn(),
  },
}));
vi.mock('@lambda/shared/sqs.utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@lambda/shared/sqs.utils')>()),
  sendMessageBatch: vi.fn(),
}));
// spied, not replaced: the real alert runs against the stubbed `fetch`, so a failed webhook request is part of the run
vi.mock('./utils/discord-alert', { spy: true });

const context = {
  functionName: 'osrs-tracker_process-players',
  logStreamName: 'log-stream',
  invokedFunctionArn: 'arn:aws:lambda:eu-central-1:123456789012:function:osrs-tracker_process-players',
} as Context;

const found: HiscoreResult = {
  status: 'found',
  hiscore: { skills: { Overall: { rank: 1, level: 2277, xp: 4_600_000_000 } }, activities: {} },
  layout: { skills: ['Overall'], activities: [] },
};
const notFound: HiscoreResult = { status: 'notFound', httpStatus: 404 };
const failed: HiscoreResult = { status: 'failed', reason: 'HTTP 503' };

function sqsEvent(bodies: PlayerScrapeMessageBody[], receiveCount = 1): SQSEvent {
  return {
    Records: bodies.map((body) => ({
      body: JSON.stringify(body),
      attributes: { ApproximateReceiveCount: String(receiveCount) },
    })),
  } as SQSEvent;
}

/** Makes `fetchHiscore` return each player's result. */
function hiscores(results: Record<string, HiscoreResult | (() => Promise<HiscoreResult>)>) {
  vi.mocked(fetchHiscore).mockImplementation(async (username) => {
    const result = results[username];
    return typeof result === 'function' ? result() : result;
  });
}

/** The messages sent to the queue, across all batches. */
function requeued(): PlayerScrapeMessageBody[] {
  return vi.mocked(sendMessageBatch).mock.calls.flatMap(([, , batch]) => batch.map(messageBody));
}

const messageBody = (message: SendMessageBatchRequestEntry): PlayerScrapeMessageBody =>
  JSON.parse(message.MessageBody!);

const alerts = () => vi.mocked(discordAlert).mock.calls.map(([title, players]) => ({ title, players }));

describe('handler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(MU.ensureHiscoreLayouts).mockResolvedValue();
    vi.mocked(MU.bulkWrite).mockImplementation(async (_, operations) => operations.length);
    vi.mocked(MU.recordHiscoreNotFound).mockResolvedValue(false);
    vi.mocked(sendMessageBatch).mockResolvedValue([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns without scraping when there are no messages', async () => {
    await expect(handler(sqsEvent([]), context)).resolves.toBe('log-stream');
    expect(fetchHiscore).not.toHaveBeenCalled();
  });

  it('stores an entry for each found player and requeues the failed ones in new messages', async () => {
    hiscores({ alice: found, bob: failed, carol: failed, dave: failed });

    await expect(
      handler(sqsEvent([{ usernames: ['alice', 'bob', 'carol', 'dave'], scrapingOffset: 3 }]), context),
    ).resolves.toBe('log-stream');

    expect(MU.ensureHiscoreLayouts).toHaveBeenCalledOnce();
    expect(MU.bulkWrite).toHaveBeenCalledExactlyOnceWith(undefined, [
      { updateOne: { filter: { username: 'alice' }, update: [] } },
    ]);
    // PLAYERS_PER_SQS_MESSAGE is 2, all in one SQS batch to SQS_QUEUE_URL
    expect(sendMessageBatch).toHaveBeenCalledOnce();
    expect(vi.mocked(sendMessageBatch).mock.calls[0][1]).toBe('https://sqs.invalid/queue');
    expect(requeued().map(({ usernames }) => usernames.length)).toEqual([2, 1]);
    expect(requeued().flatMap(({ usernames }) => usernames)).toEqual(['bob', 'carol', 'dave']);
    expect(requeued().every(({ scrapingOffset }) => scrapingOffset === 3)).toBe(true);
    expect(alerts()).toEqual([]);
  });

  describe('throws, so SQS retries the message, only when nothing was written and no 404 recorded', () => {
    it('throws when every scrape failed', async () => {
      hiscores({ alice: failed, bob: failed });

      await expect(handler(sqsEvent([{ usernames: ['alice', 'bob'], scrapingOffset: 0 }]), context)).rejects.toThrow(
        'No players were updated. Failed to update 2 players.',
      );
      expect(MU.bulkWrite).not.toHaveBeenCalled();
      expect(sendMessageBatch).not.toHaveBeenCalled();
      expect(alerts()).toEqual([]);
    });

    it('alerts before throwing on a redelivered message', async () => {
      hiscores({ alice: failed });

      await expect(handler(sqsEvent([{ usernames: ['alice'], scrapingOffset: 0 }], 2), context)).rejects.toThrow();
      expect(alerts()).toEqual([{ title: 'No players were updated', players: ['alice'] }]);
    });

    it("throws when every found player's layouts failed to store, since nothing was written", async () => {
      hiscores({ alice: found });
      vi.mocked(MU.ensureHiscoreLayouts).mockRejectedValue(new Error('Atlas unreachable'));

      await expect(handler(sqsEvent([{ usernames: ['alice'], scrapingOffset: 0 }]), context)).rejects.toThrow(
        'No players were updated',
      );
      expect(MU.bulkWrite).not.toHaveBeenCalled();
    });

    it('requeues the failed players instead when a 404 was recorded, which a retry would record again', async () => {
      hiscores({ alice: notFound, bob: failed });

      await expect(
        handler(sqsEvent([{ usernames: ['alice', 'bob'], scrapingOffset: 5 }]), context),
      ).resolves.toBeDefined();
      expect(MU.recordHiscoreNotFound).toHaveBeenCalledExactlyOnceWith(undefined, 'alice');
      expect(requeued()).toEqual([{ usernames: ['bob'], scrapingOffset: 5 }]);
    });

    it('completes when no player is on the hiscores, and alerts on the paused ones', async () => {
      hiscores({ alice: notFound, bob: notFound });
      vi.mocked(MU.recordHiscoreNotFound).mockImplementation(async (_, username) => username === 'bob');

      await expect(
        handler(sqsEvent([{ usernames: ['alice', 'bob'], scrapingOffset: 0 }]), context),
      ).resolves.toBeDefined();
      expect(MU.bulkWrite).not.toHaveBeenCalled();
      expect(sendMessageBatch).not.toHaveBeenCalled();
      expect(alerts()).toEqual([{ title: 'Paused scraping', players: ['bob'] }]);
    });
  });

  it('requeues a player whose scrape threw (recording the 404 failed) instead of dropping it', async () => {
    hiscores({ alice: notFound, bob: found });
    vi.mocked(MU.recordHiscoreNotFound).mockRejectedValue(new Error('Atlas unreachable'));

    await expect(
      handler(sqsEvent([{ usernames: ['alice', 'bob'], scrapingOffset: 1 }]), context),
    ).resolves.toBeDefined();
    expect(requeued()).toEqual([{ usernames: ['alice'], scrapingOffset: 1 }]);
  });

  it("requeues a message's players instead of writing their entries when its layouts failed to store", async () => {
    hiscores({ alice: found, bob: found });
    vi.mocked(MU.ensureHiscoreLayouts).mockRejectedValueOnce(new Error('layout id hash collision'));

    await expect(
      handler(
        sqsEvent([
          { usernames: ['alice'], scrapingOffset: 1 },
          { usernames: ['bob'], scrapingOffset: 2 },
        ]),
        context,
      ),
    ).resolves.toBeDefined();
    expect(MU.bulkWrite).toHaveBeenCalledExactlyOnceWith(undefined, [
      { updateOne: { filter: { username: 'bob' }, update: [] } },
    ]);
    expect(requeued()).toEqual([{ usernames: ['alice'], scrapingOffset: 1 }]);
  });

  // an SQS retry would store duplicate hiscore entries for the writes that did happen
  describe('never rejects once a bulk write started', () => {
    it('alerts on a failed bulk write instead of throwing or retrying it, and still requeues the failed players', async () => {
      hiscores({ alice: found, bob: failed });
      vi.mocked(MU.bulkWrite).mockRejectedValue(new Error('write conflict'));

      await expect(
        handler(sqsEvent([{ usernames: ['alice', 'bob'], scrapingOffset: 0 }]), context),
      ).resolves.toBeDefined();
      expect(requeued()).toEqual([{ usernames: ['bob'], scrapingOffset: 0 }]);
      expect(alerts()).toEqual([{ title: 'Failed to store hiscores', players: ['alice'] }]);
    });

    it('handles a bulk write that fails while a later message is still being scraped', async () => {
      // bob's scrape outlasts the rejection of alice's write: left unhandled until then, it would crash the run
      hiscores({ alice: found, bob: () => new Promise((resolve) => setTimeout(() => resolve(found), 20)) });
      vi.mocked(MU.bulkWrite).mockRejectedValueOnce(new Error('write conflict'));

      await expect(
        handler(
          sqsEvent([
            { usernames: ['alice'], scrapingOffset: 0 },
            { usernames: ['bob'], scrapingOffset: 0 },
          ]),
          context,
        ),
      ).resolves.toBeDefined();
      expect(MU.bulkWrite).toHaveBeenCalledTimes(2);
      expect(alerts()).toEqual([{ title: 'Failed to store hiscores', players: ['alice'] }]);
    });

    it.each([
      ['rejects some retry messages', (batch: SendMessageBatchRequestEntry[]) => batch.slice(0, 1)],
      ['fails to send the retry batch', (batch: SendMessageBatchRequestEntry[]) => batch],
    ])('alerts instead of throwing when SQS %s', async (_, rejected) => {
      hiscores({ alice: found, bob: failed, carol: failed, dave: failed });
      vi.mocked(sendMessageBatch).mockImplementation(async (_client, _url, batch) =>
        rejected(batch).map(({ Id }) => ({ Id, SenderFault: false, Code: 'InternalError' })),
      );

      await expect(
        handler(sqsEvent([{ usernames: ['alice', 'bob', 'carol', 'dave'], scrapingOffset: 0 }]), context),
      ).resolves.toBeDefined();
      const unqueued = rejected(vi.mocked(sendMessageBatch).mock.calls[0][2]).flatMap(
        (message) => messageBody(message).usernames,
      );
      expect(alerts()).toEqual([{ title: 'Failed to queue retries', players: unqueued }]);
    });

    it('logs a failed alert instead of throwing', async () => {
      hiscores({ alice: found });
      vi.mocked(MU.bulkWrite).mockRejectedValue(new Error('write conflict'));
      vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

      await expect(handler(sqsEvent([{ usernames: ['alice'], scrapingOffset: 0 }]), context)).resolves.toBeDefined();
      expect(fetch).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalledWith('Failed to send Discord alert', expect.any(TypeError));
    });
  });
});
