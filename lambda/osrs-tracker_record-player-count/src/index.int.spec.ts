import { fetchWorldList, parseWorldList, WorldListCounts } from '@osrs-tracker/hiscores';
import { PlayerCount, PlayerCountDay } from '@osrs-tracker/models';
import { Context, ScheduledEvent } from 'aws-lambda';
import { Collection, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { logDryRun } from '@lambda/shared/dry-run.utils';
import { sendScrapeResult } from '@lambda/shared/sqs.utils';
import { MU } from './utils/mongo.utils';

// the world list's request and parser are tested in @osrs-tracker/hiscores
vi.mock('@osrs-tracker/hiscores', () => ({ fetchWorldList: vi.fn(), parseWorldList: vi.fn() }));

vi.mock('@lambda/shared/sqs.utils', () => ({ sendScrapeResult: vi.fn() }));

// DRY_RUN is read once at import; the getter lets a test turn it on
const dryRun = vi.hoisted(() => ({ on: false }));
vi.mock('@lambda/shared/dry-run.utils', () => ({
  get DRY_RUN() {
    return dryRun.on;
  },
  logDryRun: vi.fn(),
}));

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
  byLocation: { '0': 60_000, '1': 40_000 },
};

const sample = (date: string, members: number, f2p: number, byLocation: Record<string, number>): PlayerCount => ({
  date: new Date(date),
  total: members + f2p,
  members,
  f2p,
  worlds: 180,
  byLocation,
});

/** Three samples on 2026-10-12. Location 12 first appears at noon, so it averages only the last two. */
const october12 = [
  sample('2026-10-12T00:00:00Z', 80, 20, { '0': 60, '1': 40 }),
  sample('2026-10-12T12:00:00Z', 81, 20, { '0': 59, '1': 40, '12': 2 }),
  sample('2026-10-12T23:50:00Z', 82, 22, { '0': 60, '1': 41, '12': 3 }),
];
const october12Day: PlayerCountDay = {
  date: new Date('2026-10-12T00:00:00Z'),
  total: 102, // 305 / 3 = 101.67
  members: 81,
  f2p: 21, // 62 / 3 = 20.67
  byLocation: { '0': 60, '1': 40, '12': 2 }, // 59.67, 40.33, and 5 / 2 = 2.5 rounded half to even
  peak: 104,
  samples: 3,
};

describe('record-player-count handler (MongoDB)', () => {
  let server: MongoMemoryServer;
  let client: MongoClient;
  let playerCounts: Collection<PlayerCount>;
  let days: Collection<PlayerCountDay>;
  let handler: typeof import('./index').handler;
  let discord: MockInstance<typeof fetch>;

  beforeAll(async () => {
    server = await MongoMemoryServer.create({ binary: { version: MONGODB_VERSION } });
    client = await MongoClient.connect(server.getUri());
    playerCounts = MU.col(client);
    days = MU.days(client);

    // the handler creates its client when it's imported: hand it this one
    vi.spyOn(MU, 'client').mockReturnValue(client);
    ({ handler } = await import('./index'));
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    dryRun.on = false;
    vi.mocked(logDryRun).mockClear();
    await playerCounts.deleteMany({});
    await days.deleteMany({});
    vi.mocked(fetchWorldList).mockResolvedValue(worldList);
    vi.mocked(parseWorldList).mockReturnValue(counts);
    vi.mocked(sendScrapeResult).mockReset().mockResolvedValue(true);
    // the alert's webhook is down too: the run must still fail with the world list's error
    discord = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Webhook down'));
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const storedDays = () => days.find({}, { projection: { _id: 0 }, sort: { date: 1 } }).toArray();
  /** Runs the handler as if it were `time`. Only `Date` is faked, so the driver's timers still run. */
  const runAt = (time: string) => {
    vi.setSystemTime(new Date(time));
    return handler(event, context);
  };

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
    expect(await days.countDocuments()).toBe(0);
    expect(sendScrapeResult).not.toHaveBeenCalled();
  });

  describe('scrape results queue', () => {
    it('sends the stored sample as a playerCount message, its date as an ISO string', async () => {
      await expect(runAt('2026-10-14T10:00:00Z')).resolves.toBe('test-stream');

      expect(sendScrapeResult).toHaveBeenCalledOnce();
      const [, queueUrl, message] = vi.mocked(sendScrapeResult).mock.calls[0];
      expect(queueUrl).toBe('https://sqs.invalid/osrs-tracker_scrape-results.fifo');
      expect(message).toEqual({
        v: 1,
        type: 'playerCount',
        playerCount: { ...counts, date: '2026-10-14T10:00:00.000Z' },
      });
      expect(discord).not.toHaveBeenCalled();
    });

    it("alerts, without failing the run, when the queue doesn't take it", async () => {
      vi.mocked(sendScrapeResult).mockResolvedValue(false);

      await expect(runAt('2026-10-14T10:00:00Z')).resolves.toBe('test-stream');

      expect(await playerCounts.countDocuments()).toBe(1);
      expect(discord).toHaveBeenCalledOnce();
      expect(JSON.parse(String(discord.mock.calls[0][1]?.body)).embeds[0]).toMatchObject({
        title: 'Player count not sent',
      });
    });
  });

  describe('daily averages', () => {
    const today = (samples: number): PlayerCountDay => ({
      date: new Date('2026-10-14T00:00:00Z'),
      total: counts.total,
      members: counts.members,
      f2p: counts.f2p,
      byLocation: counts.byLocation,
      peak: counts.total,
      samples,
    });

    it('averages, rounds and peaks every day with samples on the first run, skipping a day without', async () => {
      await playerCounts.insertMany(october12.map((s) => ({ ...s })));

      await expect(runAt('2026-10-14T10:00:00Z')).resolves.toBe('test-stream');

      // 2026-10-13 has no samples, so no document either: a gap, not a 0
      expect(await storedDays()).toEqual([october12Day, today(1)]);
      const index = (await days.indexes()).find(({ name }) => name === 'date_1');
      expect(index).toMatchObject({ key: { date: 1 }, unique: true });
      expect(discord).not.toHaveBeenCalled();
    });

    it("finishes yesterday on the first run after midnight, with a sample whose own run didn't add it", async () => {
      await runAt('2026-10-13T23:40:00Z');
      vi.spyOn(MU, 'mergePlayerCountDays').mockRejectedValueOnce(new Error('Atlas down'));
      await runAt('2026-10-13T23:50:00Z');
      expect(await storedDays()).toEqual([{ ...today(1), date: new Date('2026-10-13T00:00:00Z') }]);

      await runAt('2026-10-14T00:00:00Z');

      expect(await storedDays()).toEqual([{ ...today(2), date: new Date('2026-10-13T00:00:00Z') }, today(1)]);
      expect(await playerCounts.countDocuments()).toBe(3);
    });

    it('stores the sample and alerts, without failing the run, when the daily averages fail', async () => {
      vi.spyOn(MU, 'mergePlayerCountDays').mockRejectedValue(new Error('Atlas down'));

      await expect(runAt('2026-10-14T10:00:00Z')).resolves.toBe('test-stream');

      expect(await playerCounts.countDocuments()).toBe(1);
      expect(await days.countDocuments()).toBe(0);
      expect(discord).toHaveBeenCalledOnce();
      expect(JSON.parse(String(discord.mock.calls[0][1]?.body)).embeds[0]).toMatchObject({
        title: 'Daily player counts not updated',
        description: 'Error: Atlas down',
      });
    });

    it('stores the same documents when it recomputes the same days', async () => {
      await playerCounts.insertMany(october12.map((s) => ({ ...s })));
      await MU.mergePlayerCountDays(client);
      const first = await days.find().toArray();

      await MU.mergePlayerCountDays(client);
      await MU.mergePlayerCountDays(client, october12Day.date);

      expect(first).toEqual([{ ...october12Day, _id: expect.anything() }]);
      expect(await days.find().toArray()).toEqual(first);
    });

    it('only logs the days when DRY_RUN is set', async () => {
      await playerCounts.insertMany(october12.map((s) => ({ ...s })));
      dryRun.on = true;

      await MU.mergePlayerCountDays(client);

      expect(await days.countDocuments()).toBe(0);
      expect(logDryRun).toHaveBeenCalledExactlyOnceWith('store daily player counts', [october12Day]);
    });
  });
});
