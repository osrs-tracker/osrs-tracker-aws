import { fetchWorldList, parseWorldList, WorldListCounts } from '@osrs-tracker/hiscores';
import { PlayerCount } from '@osrs-tracker/models';
import { Context, ScheduledEvent } from 'aws-lambda';
import { Collection, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { MU } from './utils/mongo.utils';

// the world list's request and parser are tested in @osrs-tracker/hiscores
vi.mock('@osrs-tracker/hiscores', () => ({ fetchWorldList: vi.fn(), parseWorldList: vi.fn() }));

/** Production runs MongoDB 8.0 (Atlas), as in @osrs-tracker/models' integration tests. */
const MONGODB_VERSION = '8.0.12';

const event = {} as ScheduledEvent;
const context = {
  functionName: 'osrs-tracker_record-player-count',
  invokedFunctionArn: 'arn:aws:lambda:eu-central-1:000000000000:function:osrs-tracker_record-player-count',
  logStreamName: 'test-stream',
} as Context;

const worldList = new Uint8Array([1, 2, 3]);
const counts: WorldListCounts = {
  total: 100_000,
  members: 80_000,
  f2p: 20_000,
  worlds: 180,
  byLocation: { 'United Kingdom': 40_000, 'United States': 60_000 },
};

describe('record-player-count handler (MongoDB)', () => {
  let server: MongoMemoryServer;
  let client: MongoClient;
  let playerCounts: Collection<PlayerCount>;
  let handler: typeof import('./index').handler;
  let discord: MockInstance<typeof fetch>;

  beforeAll(async () => {
    server = await MongoMemoryServer.create({ binary: { version: MONGODB_VERSION } });
    client = await MongoClient.connect(server.getUri());
    playerCounts = MU.col(client);

    // the handler creates its client when it's imported: hand it this one
    vi.spyOn(MU, 'client').mockReturnValue(client);
    ({ handler } = await import('./index'));
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    await playerCounts.deleteMany({});
    vi.mocked(fetchWorldList).mockResolvedValue(worldList);
    vi.mocked(parseWorldList).mockReturnValue(counts);
    // the alert's webhook is down too: the run must still fail with the world list's error
    discord = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Webhook down'));
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('inserts one document with the parsed counts and the date of the run', async () => {
    const before = Date.now();

    await expect(handler(event, context)).resolves.toBe('test-stream');

    const stored = await playerCounts.find({}, { projection: { _id: 0 } }).toArray();
    expect(stored).toEqual([{ ...counts, date: expect.any(Date) }]);
    expect(stored[0].date.getTime()).toBeGreaterThanOrEqual(before);
    expect(stored[0].date.getTime()).toBeLessThanOrEqual(Date.now());
    expect(parseWorldList).toHaveBeenCalledWith(worldList);
    expect(await playerCounts.indexExists('date_1')).toBe(true);
    expect(discord).not.toHaveBeenCalled();
  });

  it.each<[string, () => void, string]>([
    ['the request fails', () => vi.mocked(fetchWorldList).mockRejectedValue(new Error('HTTP 503')), 'HTTP 503'],
    [
      "the list doesn't parse",
      () =>
        vi.mocked(parseWorldList).mockImplementation(() => {
          throw new Error('Truncated world list');
        }),
      'Truncated world list',
    ],
    [
      'it has 0 worlds',
      () => vi.mocked(parseWorldList).mockReturnValue({ ...counts, worlds: 0 }),
      'The world list has 0 worlds and 100000 players.',
    ],
    [
      'it has 0 players',
      () => vi.mocked(parseWorldList).mockReturnValue({ ...counts, total: 0, members: 0, f2p: 0 }),
      'The world list has 180 worlds and 0 players.',
    ],
  ])('alerts and rethrows the original error, recording nothing, when %s', async (_, arrange, message) => {
    arrange();

    await expect(handler(event, context)).rejects.toThrow(message);

    expect(discord).toHaveBeenCalledOnce();
    const [url, init] = discord.mock.calls[0];
    expect(url).toBe(process.env.WEBHOOK_URL);
    expect(JSON.parse(String(init?.body)).embeds[0]).toMatchObject({
      title: 'Player count not recorded',
      description: `Error: ${message}`,
    });
    expect(await playerCounts.countDocuments()).toBe(0);
  });
});
