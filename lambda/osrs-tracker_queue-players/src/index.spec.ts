import { Context, ScheduledEvent } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discordAlert } from '@lambda/shared/discord-alert';
import { invokeAsync } from '@lambda/shared/lambda.utils';
import { handler } from './index';
import { scanSubscriptions } from './utils/subscriptions.utils';

vi.mock('./utils/subscriptions.utils', () => ({ scanSubscriptions: vi.fn() }));
vi.mock('@lambda/shared/lambda.utils', () => ({ invokeAsync: vi.fn() }));
vi.mock('@lambda/shared/discord-alert', () => ({ discordAlert: vi.fn() }));

const context = { logStreamName: 'stream' } as Context;
const run = (time = '2026-10-14T03:00:00Z') => handler({ time } as ScheduledEvent, context);

/** Makes the table hold one subscription per username, each to `offset`, plus one player on another offset. */
function players(offset: number, ...usernames: string[]) {
  vi.mocked(scanSubscriptions).mockResolvedValue([
    ...usernames.map((username) => ({ username, scrapingOffsets: new Set([offset]) })),
    { username: 'elsewhere', scrapingOffsets: new Set([offset + 1]) },
  ]);
}

const payloads = () => vi.mocked(invokeAsync).mock.calls.map(([, , payload]) => payload);

describe('handler', () => {
  beforeEach(() => {
    vi.mocked(invokeAsync).mockResolvedValue(true);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("invokes process-players once per PLAYERS_PER_EVENT of the hour's players", async () => {
    // PLAYERS_PER_EVENT is 2
    players(3, 'alice', 'bob', 'carol');

    expect(await run()).toBe('stream');

    expect(scanSubscriptions).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'osrs-tracker_subscriptions');
    expect(vi.mocked(invokeAsync).mock.calls.every(([, functionName]) => functionName === 'process-players')).toBe(
      true,
    );
    expect(payloads()).toEqual([
      { usernames: ['alice', 'bob'], scrapingOffset: 3 },
      { usernames: ['carol'], scrapingOffset: 3 },
    ]);
    expect(discordAlert).not.toHaveBeenCalled();
  });

  it('invokes nothing when no player has the offset', async () => {
    players(3);

    await run('2026-10-14T23:00:00Z');

    expect(invokeAsync).not.toHaveBeenCalled();
    expect(discordAlert).not.toHaveBeenCalled();
  });

  it('invokes nothing and alerts when the table is empty', async () => {
    vi.mocked(scanSubscriptions).mockResolvedValue([]);

    expect(await run()).toBe('stream');

    expect(invokeAsync).not.toHaveBeenCalled();
    expect(discordAlert).toHaveBeenCalledExactlyOnceWith(
      'https://discord.invalid/webhook',
      'No subscriptions',
      'osrs-tracker_subscriptions is empty: no players were queued for offset 3.',
      context,
    );
  });

  it('still invokes the other events, then alerts once with the count, when Lambda refuses some', async () => {
    players(3, 'alice', 'bob', 'carol', 'dave', 'erin');
    vi.mocked(invokeAsync).mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await run();

    expect(invokeAsync).toHaveBeenCalledTimes(3);
    expect(discordAlert).toHaveBeenCalledExactlyOnceWith(
      'https://discord.invalid/webhook',
      'Failed to queue players',
      'Error count: 2',
      context,
    );
  });
});
