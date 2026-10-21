import { LambdaClient } from '@aws-sdk/client-lambda';
import { SQSClient } from '@aws-sdk/client-sqs';
import { Context } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeAsync } from '@lambda/shared/lambda.utils';
import { sendScrapeResult } from '@lambda/shared/sqs.utils';
import { afterWrites, AwsClients, MAX_RETRIES, ScrapeRun } from './after-writes';
import { discordAlert } from './discord-alert';

// the outcomes it shares with the handler (failed writes, refused retries, paused players) are in index.spec.ts
vi.mock('@lambda/shared/lambda.utils', () => ({ invokeAsync: vi.fn() }));
vi.mock('@lambda/shared/sqs.utils', () => ({ sendScrapeResult: vi.fn() }));
vi.mock('./discord-alert', () => ({ discordAlert: vi.fn() }));

const lambdaClient = {} as LambdaClient;
const sqsClient = {} as SQSClient;
const clients: AwsClients = { lambda: lambdaClient, sqs: sqsClient };
const context = { functionName: 'osrs-tracker_process-players', logStreamName: 'log-stream' } as Context;

function run(overrides: Partial<ScrapeRun>): ScrapeRun {
  return {
    event: { usernames: [], scrapingOffset: 0 },
    scrapedAt: new Date('2026-10-21T13:00:02Z'),
    found: [],
    failedUsernames: [],
    notFoundUsernames: [],
    pausedUsernames: [],
    ...overrides,
  };
}

const usernames = (count: number, prefix: string) => Array.from({ length: count }, (_, i) => `${prefix}${i}`);
const alerts = () => vi.mocked(discordAlert).mock.calls.map(([title, players]) => [title, players]);

describe('afterWrites', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(invokeAsync).mockResolvedValue(true);
    vi.mocked(sendScrapeResult).mockResolvedValue(true);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('sends the found hiscores to the scrape results queue', () => {
    const alice = {
      username: 'alice',
      hiscore: { skills: { Overall: { rank: 1, level: 2277, xp: 4_600_000_000 } }, activities: {} },
      layout: { skills: ['Overall'], activities: [] },
    };
    const settled = (result: PromiseSettledResult<number>) => ({
      usernames: ['alice'],
      result: Promise.resolve(result),
    });

    it('in one hiscores message, with the scrape time and offset, and without the not-found players', async () => {
      await afterWrites(
        clients,
        run({
          event: { usernames: [], scrapingOffset: -4 },
          bulkWrite: settled({ status: 'fulfilled', value: 1 }),
          found: [alice],
          notFoundUsernames: ['bob'],
        }),
        context,
      );

      expect(sendScrapeResult).toHaveBeenCalledExactlyOnceWith(
        sqsClient,
        'https://sqs.invalid/osrs-tracker_scrape-results.fifo',
        {
          v: 1,
          type: 'hiscores',
          scrapedAt: '2026-10-21T13:00:02.000Z',
          scrapingOffset: -4,
          found: [alice],
          notFound: [],
        },
      );
      expect(alerts()).toEqual([]);
    });

    it('only once the bulk write settled', async () => {
      let settle!: (result: PromiseSettledResult<number>) => void;
      const result = new Promise<PromiseSettledResult<number>>((resolve) => (settle = resolve));

      const done = afterWrites(clients, run({ bulkWrite: { usernames: ['alice'], result }, found: [alice] }), context);
      await Promise.resolve();
      expect(sendScrapeResult).not.toHaveBeenCalled();

      settle({ status: 'fulfilled', value: 1 });
      await done;
      expect(sendScrapeResult).toHaveBeenCalledOnce();
    });

    it('also when the bulk write failed, so the ingester stores those entries', async () => {
      await afterWrites(
        clients,
        run({ bulkWrite: settled({ status: 'rejected', reason: new Error('write conflict') }), found: [alice] }),
        context,
      );

      expect(sendScrapeResult).toHaveBeenCalledOnce();
      expect(alerts()).toEqual([['Failed to store hiscores', ['alice']]]);
    });

    it('sends nothing when no player was found', async () => {
      await afterWrites(clients, run({ notFoundUsernames: ['bob'] }), context);

      expect(sendScrapeResult).not.toHaveBeenCalled();
    });

    it("alerts on the message's players instead of throwing when SQS doesn't take it", async () => {
      vi.mocked(sendScrapeResult).mockResolvedValue(false);

      await expect(
        afterWrites(clients, run({ bulkWrite: settled({ status: 'fulfilled', value: 1 }), found: [alice] }), context),
      ).resolves.toBeUndefined();
      expect(alerts()).toEqual([['Failed to send scrape results', ['alice']]]);
    });
  });

  it('requeues the failed players to this function in events of PLAYERS_PER_EVENT, with the offset kept', async () => {
    // PLAYERS_PER_EVENT is 2
    const failedUsernames = usernames(5, 'a');

    await afterWrites(clients, run({ event: { usernames: [], scrapingOffset: -4 }, failedUsernames }), context);

    expect(vi.mocked(invokeAsync).mock.calls).toEqual(
      [['a0', 'a1'], ['a2', 'a3'], ['a4']].map((players) => [
        lambdaClient,
        'osrs-tracker_process-players',
        { usernames: players, scrapingOffset: -4, retry: 1 },
      ]),
    );
  });

  it.each([...Array(MAX_RETRIES).keys()])('requeues without an alert at retry %i', async (retry) => {
    await afterWrites(
      clients,
      run({ event: { usernames: [], scrapingOffset: 0, retry }, failedUsernames: ['alice'] }),
      context,
    );

    expect(invokeAsync).toHaveBeenCalledExactlyOnceWith(lambdaClient, context.functionName, {
      usernames: ['alice'],
      scrapingOffset: 0,
      retry: retry + 1,
    });
    expect(alerts()).toEqual([]);
  });

  it('gives up on the failed players at retry MAX_RETRIES and alerts instead', async () => {
    await afterWrites(
      clients,
      run({ event: { usernames: [], scrapingOffset: 0, retry: MAX_RETRIES }, failedUsernames: ['alice'] }),
      context,
    );

    expect(invokeAsync).not.toHaveBeenCalled();
    expect(alerts()).toEqual([['Gave up retrying', ['alice']]]);
  });

  it('neither requeues nor alerts at retry MAX_RETRIES when no player failed', async () => {
    await afterWrites(clients, run({ event: { usernames: [], scrapingOffset: 0, retry: MAX_RETRIES } }), context);

    expect(invokeAsync).not.toHaveBeenCalled();
    expect(alerts()).toEqual([]);
  });
});
