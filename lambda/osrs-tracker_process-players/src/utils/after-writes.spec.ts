import { LambdaClient } from '@aws-sdk/client-lambda';
import { Context } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeAsync } from '@lambda/shared/lambda.utils';
import { afterWrites, MAX_RETRIES, ScrapeRun } from './after-writes';
import { discordAlert } from './discord-alert';

// the outcomes it shares with the handler (failed writes, refused retries, paused players) are in index.spec.ts
vi.mock('@lambda/shared/lambda.utils', () => ({ invokeAsync: vi.fn() }));
vi.mock('./discord-alert', () => ({ discordAlert: vi.fn() }));

const lambdaClient = {} as LambdaClient;
const context = { functionName: 'osrs-tracker_process-players', logStreamName: 'log-stream' } as Context;

function run(overrides: Partial<ScrapeRun>): ScrapeRun {
  return {
    event: { usernames: [], scrapingOffset: 0 },
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
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('requeues the failed players to this function in events of PLAYERS_PER_EVENT, with the offset kept', async () => {
    // PLAYERS_PER_EVENT is 2
    const failedUsernames = usernames(5, 'a');

    await afterWrites(lambdaClient, run({ event: { usernames: [], scrapingOffset: -4 }, failedUsernames }), context);

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
      lambdaClient,
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
      lambdaClient,
      run({ event: { usernames: [], scrapingOffset: 0, retry: MAX_RETRIES }, failedUsernames: ['alice'] }),
      context,
    );

    expect(invokeAsync).not.toHaveBeenCalled();
    expect(alerts()).toEqual([['Gave up retrying', ['alice']]]);
  });

  it('neither requeues nor alerts at retry MAX_RETRIES when no player failed', async () => {
    await afterWrites(lambdaClient, run({ event: { usernames: [], scrapingOffset: 0, retry: MAX_RETRIES } }), context);

    expect(invokeAsync).not.toHaveBeenCalled();
    expect(alerts()).toEqual([]);
  });
});
