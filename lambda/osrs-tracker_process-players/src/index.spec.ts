import { HiscoreResult } from '@osrs-tracker/hiscores';
import { Context } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeAsync } from '@lambda/shared/lambda.utils';
import { handler } from './index';
import { discordAlert } from './utils/discord-alert';
import { MU } from './utils/mongo.utils';
import { fetchHiscore } from './utils/player.utils';
import { ScrapeEvent } from './utils/scrape-message';

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
vi.mock('@lambda/shared/lambda.utils', () => ({ invokeAsync: vi.fn() }));
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

/** Makes `fetchHiscore` return each player's result. */
function hiscores(results: Record<string, HiscoreResult | (() => Promise<HiscoreResult>)>) {
  vi.mocked(fetchHiscore).mockImplementation(async (username) => {
    const result = results[username];
    return typeof result === 'function' ? result() : result;
  });
}

/** The events the run requeued, in the order it invoked them. */
const requeued = () => vi.mocked(invokeAsync).mock.calls.map(([, , event]) => event as ScrapeEvent);

const alerts = () => vi.mocked(discordAlert).mock.calls.map(([title, players]) => ({ title, players }));

describe('handler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(MU.ensureHiscoreLayouts).mockResolvedValue();
    vi.mocked(MU.bulkWrite).mockImplementation(async (_, operations) => operations.length);
    vi.mocked(MU.recordHiscoreNotFound).mockResolvedValue(false);
    vi.mocked(invokeAsync).mockResolvedValue(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns without scraping when there are no players', async () => {
    await expect(handler({ usernames: [], scrapingOffset: 0 }, context)).resolves.toBe('log-stream');
    expect(fetchHiscore).not.toHaveBeenCalled();
  });

  it('stores an entry for each found player and requeues the failed ones in new events to itself', async () => {
    hiscores({ alice: found, bob: failed, carol: failed, dave: failed });

    await expect(handler({ usernames: ['alice', 'bob', 'carol', 'dave'], scrapingOffset: 3 }, context)).resolves.toBe(
      'log-stream',
    );

    expect(MU.ensureHiscoreLayouts).toHaveBeenCalledOnce();
    expect(MU.bulkWrite).toHaveBeenCalledExactlyOnceWith(undefined, [
      { updateOne: { filter: { username: 'alice' }, update: [] } },
    ]);
    // PLAYERS_PER_EVENT is 2
    expect(vi.mocked(invokeAsync).mock.calls.map(([, functionName]) => functionName)).toEqual([
      'osrs-tracker_process-players',
      'osrs-tracker_process-players',
    ]);
    expect(requeued()).toEqual([
      { usernames: ['bob', 'carol'], scrapingOffset: 3, retry: 1 },
      { usernames: ['dave'], scrapingOffset: 3, retry: 1 },
    ]);
    expect(alerts()).toEqual([]);
  });

  describe('throws, so Lambda retries the event, only when nothing was written and no 404 recorded', () => {
    it('throws when every scrape failed', async () => {
      hiscores({ alice: failed, bob: failed });

      await expect(handler({ usernames: ['alice', 'bob'], scrapingOffset: 0 }, context)).rejects.toThrow(
        'No players were updated. Failed to update 2 players.',
      );
      expect(MU.bulkWrite).not.toHaveBeenCalled();
      expect(invokeAsync).not.toHaveBeenCalled();
      expect(alerts()).toEqual([]);
    });

    it('alerts before throwing on a requeued event', async () => {
      hiscores({ alice: failed });

      await expect(handler({ usernames: ['alice'], scrapingOffset: 0, retry: 1 }, context)).rejects.toThrow();
      expect(alerts()).toEqual([{ title: 'No players were updated', players: ['alice'] }]);
    });

    it("throws when every found player's layouts failed to store, since nothing was written", async () => {
      hiscores({ alice: found });
      vi.mocked(MU.ensureHiscoreLayouts).mockRejectedValue(new Error('Atlas unreachable'));

      await expect(handler({ usernames: ['alice'], scrapingOffset: 0 }, context)).rejects.toThrow(
        'No players were updated',
      );
      expect(MU.bulkWrite).not.toHaveBeenCalled();
    });

    it('requeues the failed players instead when a 404 was recorded, which a retry would record again', async () => {
      hiscores({ alice: notFound, bob: failed });

      await expect(handler({ usernames: ['alice', 'bob'], scrapingOffset: 5 }, context)).resolves.toBeDefined();
      expect(MU.recordHiscoreNotFound).toHaveBeenCalledExactlyOnceWith(undefined, 'alice');
      expect(requeued()).toEqual([{ usernames: ['bob'], scrapingOffset: 5, retry: 1 }]);
    });

    it('completes when no player is on the hiscores, and alerts on the paused ones', async () => {
      hiscores({ alice: notFound, bob: notFound });
      vi.mocked(MU.recordHiscoreNotFound).mockImplementation(async (_, username) => username === 'bob');

      await expect(handler({ usernames: ['alice', 'bob'], scrapingOffset: 0 }, context)).resolves.toBeDefined();
      expect(MU.bulkWrite).not.toHaveBeenCalled();
      expect(invokeAsync).not.toHaveBeenCalled();
      expect(alerts()).toEqual([{ title: 'Paused scraping', players: ['bob'] }]);
    });
  });

  it('requeues a player whose scrape threw (recording the 404 failed) instead of dropping it', async () => {
    hiscores({ alice: notFound, bob: found });
    vi.mocked(MU.recordHiscoreNotFound).mockRejectedValue(new Error('Atlas unreachable'));

    await expect(handler({ usernames: ['alice', 'bob'], scrapingOffset: 1 }, context)).resolves.toBeDefined();
    expect(requeued()).toEqual([{ usernames: ['alice'], scrapingOffset: 1, retry: 1 }]);
  });

  it('requeues the found players instead of writing their entries when their layouts failed to store', async () => {
    // alice's 404 keeps the run from throwing
    hiscores({ alice: notFound, bob: found, carol: found });
    vi.mocked(MU.ensureHiscoreLayouts).mockRejectedValueOnce(new Error('layout id hash collision'));

    await expect(handler({ usernames: ['alice', 'bob', 'carol'], scrapingOffset: 1 }, context)).resolves.toBeDefined();
    expect(MU.bulkWrite).not.toHaveBeenCalled();
    expect(requeued()).toEqual([{ usernames: ['bob', 'carol'], scrapingOffset: 1, retry: 1 }]);
  });

  it('counts the retry up from a requeued event, then gives up and alerts past MAX_RETRIES', async () => {
    hiscores({ alice: found, bob: failed });

    await handler({ usernames: ['alice', 'bob'], scrapingOffset: 2, retry: 2 }, context);
    expect(requeued()).toEqual([{ usernames: ['bob'], scrapingOffset: 2, retry: 3 }]);

    vi.mocked(invokeAsync).mockClear();
    await handler({ usernames: ['alice', 'bob'], scrapingOffset: 2, retry: 3 }, context);
    expect(invokeAsync).not.toHaveBeenCalled();
    expect(alerts()).toEqual([{ title: 'Gave up retrying', players: ['bob'] }]);
  });

  // a Lambda retry would store duplicate hiscore entries for the writes that did happen
  describe('never rejects once a bulk write started', () => {
    it('alerts on a failed bulk write instead of throwing or retrying it, and still requeues the failed players', async () => {
      hiscores({ alice: found, bob: failed });
      vi.mocked(MU.bulkWrite).mockRejectedValue(new Error('write conflict'));

      await expect(handler({ usernames: ['alice', 'bob'], scrapingOffset: 0 }, context)).resolves.toBeDefined();
      expect(requeued()).toEqual([{ usernames: ['bob'], scrapingOffset: 0, retry: 1 }]);
      expect(alerts()).toEqual([{ title: 'Failed to store hiscores', players: ['alice'] }]);
    });

    it.each([
      ['refuses one of the retry events', [false, true], ['bob', 'carol']],
      ['refuses every retry event', [false, false], ['bob', 'carol', 'dave']],
    ])('alerts instead of throwing when Lambda %s', async (_, accepted, unqueued) => {
      hiscores({ alice: found, bob: failed, carol: failed, dave: failed });
      accepted.forEach((ok) => vi.mocked(invokeAsync).mockResolvedValueOnce(ok));

      await expect(
        handler({ usernames: ['alice', 'bob', 'carol', 'dave'], scrapingOffset: 0 }, context),
      ).resolves.toBeDefined();
      expect(alerts()).toEqual([{ title: 'Failed to queue retries', players: unqueued }]);
    });

    it('logs a failed alert instead of throwing', async () => {
      hiscores({ alice: found });
      vi.mocked(MU.bulkWrite).mockRejectedValue(new Error('write conflict'));
      vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

      await expect(handler({ usernames: ['alice'], scrapingOffset: 0 }, context)).resolves.toBeDefined();
      expect(fetch).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalledWith('Failed to send Discord alert', expect.any(TypeError));
    });
  });
});
