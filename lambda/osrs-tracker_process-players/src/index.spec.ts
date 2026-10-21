import { HiscoreResult } from '@osrs-tracker/hiscores';
import { Context } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeAsync } from '@lambda/shared/lambda.utils';
import { sendScrapeResult } from '@lambda/shared/sqs.utils';
import { handler } from './index';
import { discordAlert } from './utils/discord-alert';
import { fetchHiscore } from './utils/player.utils';
import { ScrapeEvent } from './utils/scrape-message';

// the staggered hiscore requests wait 2 s per player
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => {}) }));
vi.mock('./utils/player.utils', () => ({ fetchHiscore: vi.fn() }));
vi.mock('@lambda/shared/lambda.utils', () => ({ invokeAsync: vi.fn() }));
vi.mock('@lambda/shared/sqs.utils', () => ({ sendScrapeResult: vi.fn() }));
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

/** The messages the run sent to the scrape results queue. */
const sent = () => vi.mocked(sendScrapeResult).mock.calls.map(([, , message]) => message);

/** The events the run requeued, in the order it invoked them. */
const requeued = () => vi.mocked(invokeAsync).mock.calls.map(([, , event]) => event as ScrapeEvent);

const alerts = () => vi.mocked(discordAlert).mock.calls.map(([title, players]) => ({ title, players }));

describe('handler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(invokeAsync).mockResolvedValue(true);
    vi.mocked(sendScrapeResult).mockResolvedValue();
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

  it('sends the found and not-found players in one hiscores message, with one scrape time and the offset', async () => {
    hiscores({ alice: found, bob: notFound, carol: failed });
    const before = Date.now();

    await expect(handler({ usernames: ['alice', 'bob', 'carol'], scrapingOffset: 3 }, context)).resolves.toBe(
      'log-stream',
    );

    expect(sent()).toEqual([
      {
        v: 1,
        type: 'hiscores',
        scrapedAt: expect.any(String),
        scrapingOffset: 3,
        found: [{ username: 'alice', hiscore: found.hiscore, layout: found.layout }],
        notFound: ['bob'],
      },
    ]);
    const scrapedAt = Date.parse((sent()[0] as { scrapedAt: string }).scrapedAt);
    expect(scrapedAt).toBeGreaterThanOrEqual(before);
    expect(scrapedAt).toBeLessThanOrEqual(Date.now());
  });

  it('requeues the failed players in new events to itself, after the send', async () => {
    hiscores({ alice: found, bob: failed, carol: failed, dave: failed });

    await handler({ usernames: ['alice', 'bob', 'carol', 'dave'], scrapingOffset: 3 }, context);

    // PLAYERS_PER_EVENT is 2
    expect(vi.mocked(invokeAsync).mock.calls.map(([, functionName]) => functionName)).toEqual([
      'osrs-tracker_process-players',
      'osrs-tracker_process-players',
    ]);
    expect(requeued()).toEqual([
      { usernames: ['bob', 'carol'], scrapingOffset: 3, retry: 1 },
      { usernames: ['dave'], scrapingOffset: 3, retry: 1 },
    ]);
    expect(vi.mocked(sendScrapeResult).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(invokeAsync).mock.invocationCallOrder[0],
    );
    expect(alerts()).toEqual([]);
  });

  describe('throws, so Lambda retries the event, only when there is nothing to send or the send fails', () => {
    it('throws when every scrape failed', async () => {
      hiscores({ alice: failed, bob: failed });

      await expect(handler({ usernames: ['alice', 'bob'], scrapingOffset: 0 }, context)).rejects.toThrow(
        'No players were updated. Failed to update 2 players.',
      );
      expect(sendScrapeResult).not.toHaveBeenCalled();
      expect(invokeAsync).not.toHaveBeenCalled();
      expect(alerts()).toEqual([]);
    });

    it('alerts before throwing on a requeued event', async () => {
      hiscores({ alice: failed });

      await expect(handler({ usernames: ['alice'], scrapingOffset: 0, retry: 1 }, context)).rejects.toThrow();
      expect(alerts()).toEqual([{ title: 'No players were updated', players: ['alice'] }]);
    });

    it("throws SQS's error, without requeueing, when the queue doesn't take the message", async () => {
      hiscores({ alice: found, bob: failed });
      vi.mocked(sendScrapeResult).mockRejectedValue(new Error('Access denied'));

      await expect(handler({ usernames: ['alice', 'bob'], scrapingOffset: 0 }, context)).rejects.toThrow(
        'Access denied',
      );
      expect(invokeAsync).not.toHaveBeenCalled();
    });

    it('sends and requeues the failed players when only a 404 was found', async () => {
      hiscores({ alice: notFound, bob: failed });

      await expect(handler({ usernames: ['alice', 'bob'], scrapingOffset: 5 }, context)).resolves.toBeDefined();
      expect(sent()).toMatchObject([{ found: [], notFound: ['alice'] }]);
      expect(requeued()).toEqual([{ usernames: ['bob'], scrapingOffset: 5, retry: 1 }]);
    });

    it('completes when no player is on the hiscores', async () => {
      hiscores({ alice: notFound, bob: notFound });

      await expect(handler({ usernames: ['alice', 'bob'], scrapingOffset: 0 }, context)).resolves.toBeDefined();
      expect(sent()).toMatchObject([{ found: [], notFound: ['alice', 'bob'] }]);
      expect(invokeAsync).not.toHaveBeenCalled();
      expect(alerts()).toEqual([]);
    });
  });

  it('requeues a player whose scrape threw instead of dropping it', async () => {
    hiscores({ alice: () => Promise.reject(new Error('Unexpected')), bob: found });

    await expect(handler({ usernames: ['alice', 'bob'], scrapingOffset: 1 }, context)).resolves.toBeDefined();
    expect(requeued()).toEqual([{ usernames: ['alice'], scrapingOffset: 1, retry: 1 }]);
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

  // a Lambda retry would requeue the failed players a second time
  describe('never rejects once the results are sent', () => {
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
      hiscores({ alice: found, bob: failed });
      vi.mocked(invokeAsync).mockResolvedValue(false);
      vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

      await expect(handler({ usernames: ['alice', 'bob'], scrapingOffset: 0 }, context)).resolves.toBeDefined();
      expect(fetch).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalledWith('Failed to send Discord alert', expect.any(TypeError));
    });
  });
});
