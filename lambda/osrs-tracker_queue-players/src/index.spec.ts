import { Context, ScheduledEvent } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discordAlert } from '@lambda/shared/discord-alert';
import { invokeAsync } from '@lambda/shared/lambda.utils';
import { handler } from './index';
import { MU } from './utils/mongo.utils';

const client = vi.hoisted(() => ({ fake: 'MongoClient' }));
const close = vi.hoisted(() => vi.fn());
vi.mock('./utils/mongo.utils', () => ({
  MU: { client: () => client, col: vi.fn(), getAllUsernamesForOffset: vi.fn() },
}));
vi.mock('@lambda/shared/mongo.utils', () => ({ ensureIndex: vi.fn() }));
vi.mock('@lambda/shared/lambda.utils', () => ({ invokeAsync: vi.fn() }));
vi.mock('@lambda/shared/discord-alert', () => ({ discordAlert: vi.fn() }));

const context = { logStreamName: 'stream' } as Context;
const run = (time = '2026-10-14T03:00:00Z') => handler({ time } as ScheduledEvent, context);

/** Makes the cursor yield `usernames`. */
function players(...usernames: string[]) {
  async function* cursor() {
    yield* usernames;
  }
  vi.mocked(MU.getAllUsernamesForOffset).mockReturnValue(
    Object.assign(cursor(), { close }) as unknown as ReturnType<typeof MU.getAllUsernamesForOffset>,
  );
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

  it("invokes process-players once per PLAYERS_PER_EVENT of the hour's players, then closes the cursor", async () => {
    // PLAYERS_PER_EVENT is 2
    players('alice', 'bob', 'carol');

    expect(await run()).toBe('stream');

    expect(MU.getAllUsernamesForOffset).toHaveBeenCalledExactlyOnceWith(client, 3);
    expect(vi.mocked(invokeAsync).mock.calls.every(([, functionName]) => functionName === 'process-players')).toBe(
      true,
    );
    expect(payloads()).toEqual([
      { usernames: ['alice', 'bob'], scrapingOffset: 3 },
      { usernames: ['carol'], scrapingOffset: 3 },
    ]);
    expect(close).toHaveBeenCalledOnce();
    expect(discordAlert).not.toHaveBeenCalled();
  });

  it('invokes nothing when no player has the offset', async () => {
    players();

    await run('2026-10-14T23:00:00Z');

    expect(MU.getAllUsernamesForOffset).toHaveBeenCalledExactlyOnceWith(client, -1);
    expect(invokeAsync).not.toHaveBeenCalled();
  });

  it('still invokes the other events, then alerts once with the count, when Lambda refuses some', async () => {
    players('alice', 'bob', 'carol', 'dave', 'erin');
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
