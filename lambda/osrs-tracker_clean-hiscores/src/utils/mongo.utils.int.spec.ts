import { PlayerStatus, PlayerType, StoredHiscoreEntry, StoredPlayer } from '@osrs-tracker/models';
import { subDays, subHours } from 'date-fns';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { logDryRun } from '@lambda/shared/dry-run.utils';
import { MU } from './mongo.utils';

/** Production runs MongoDB 8.0 (Atlas). */
const MONGODB_VERSION = '8.0.12';

// DRY_RUN is read once at import; the getter lets a test turn it on
const dryRun = vi.hoisted(() => ({ on: false }));
vi.mock('@lambda/shared/dry-run.utils', () => ({
  get DRY_RUN() {
    return dryRun.on;
  },
  logDryRun: vi.fn(),
}));

const NOW = new Date('2026-10-14T00:00:00Z');
const CUTOFF = subDays(NOW, 180);
const daysAgo = (days: number) => subDays(NOW, days);

const entry = (o: number, d: Date, l = 1): StoredHiscoreEntry => ({ d, o, l, s: [], a: [] });

const player = (username: string, fields: Partial<StoredPlayer> = {}): StoredPlayer => ({
  username,
  combatLevel: 3,
  type: PlayerType.Normal,
  status: PlayerStatus.Default,
  diedAsHardcore: false,
  lastModified: daysAgo(1),
  ...fields,
});

describe('MU (MongoDB)', () => {
  let server: MongoMemoryServer;
  let client: MongoClient;

  beforeAll(async () => {
    server = await MongoMemoryServer.create({ binary: { version: MONGODB_VERSION } });
    client = await MongoClient.connect(server.getUri());
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    dryRun.on = false;
    vi.mocked(logDryRun).mockClear();
    await MU.col(client).deleteMany({});
    await MU.layouts(client).deleteMany({});
  });

  const stored = (username: string) => MU.col(client).findOne({ username }, { projection: { _id: 0 } });
  const usernames = async () => (await MU.col(client).find().toArray()).map(({ username }) => username).sort();
  const everything = async () => [await MU.col(client).find().toArray(), await MU.layouts(client).find().toArray()];

  /** Runs `write` with `DRY_RUN` on and checks it changed nothing; returns its result. */
  async function dryRunWritesNothing<T>(write: () => Promise<T>): Promise<T> {
    const before = await everything();
    dryRun.on = true;
    const result = await write();
    expect(await everything()).toEqual(before);
    expect(logDryRun).toHaveBeenCalledOnce();
    return result;
  }

  describe('dropUnusedScrapingOffsets', () => {
    /** The players that lost offsets, sorted: MongoDB's set operators don't keep an order. */
    const drop = async () =>
      (await MU.dropUnusedScrapingOffsets(client, CUTOFF, NOW))
        .map(({ username, dropped }) => ({ username, dropped: [...dropped].sort((x, y) => x - y) }))
        .sort((x, y) => x.username.localeCompare(y.username));

    it('keeps an offset looked up within 180 days and drops a stale one with all its entries', async () => {
      await MU.col(client).insertOne(
        player('a', {
          scrapingOffsets: [0, 1, 2],
          scrapingOffsetLookups: { '0': daysAgo(10), '1': CUTOFF, '2': daysAgo(181) },
          hiscoreEntries: [entry(0, daysAgo(1)), entry(2, daysAgo(1)), entry(1, daysAgo(2)), entry(2, daysAgo(2))],
        }),
      );

      expect(await drop()).toEqual([{ username: 'a', dropped: [2] }]);

      const a = await stored('a');
      expect(a?.scrapingOffsets).toEqual([0, 1]);
      expect(a?.scrapingOffsetLookups).toEqual({ '0': daysAgo(10), '1': CUTOFF });
      expect(a?.hiscoreEntries).toEqual([entry(0, daysAgo(1)), entry(1, daysAgo(2))]);
      expect(a).not.toHaveProperty('pausedScrapingOffsets');
    });

    it('keeps the most recently looked-up offset when every offset is stale', async () => {
      await MU.col(client).insertOne(
        player('a', {
          scrapingOffsets: [-5, 3],
          scrapingOffsetLookups: { '-5': daysAgo(300), '3': daysAgo(200) },
          hiscoreEntries: [entry(-5, daysAgo(1)), entry(3, daysAgo(1))],
        }),
      );

      expect(await drop()).toEqual([{ username: 'a', dropped: [-5] }]);

      const a = await stored('a');
      expect(a?.scrapingOffsets).toEqual([3]);
      expect(a?.scrapingOffsetLookups).toEqual({ '3': daysAgo(200) });
      expect(a?.hiscoreEntries).toEqual([entry(3, daysAgo(1))]);
    });

    it('treats a paused offset like an active one', async () => {
      await MU.col(client).insertMany([
        player('a', {
          scrapingOffsets: [0, 1],
          pausedScrapingOffsets: [5, 6],
          scrapingOffsetLookups: { '0': daysAgo(10), '1': daysAgo(200), '5': daysAgo(10), '6': daysAgo(200) },
          hiscoreEntries: [entry(0, daysAgo(1)), entry(1, daysAgo(1)), entry(5, daysAgo(9)), entry(6, daysAgo(9))],
        }),
        // every offset stale: the paused one was looked up last, so it's the one kept
        player('b', {
          scrapingOffsets: [0],
          pausedScrapingOffsets: [5],
          scrapingOffsetLookups: { '0': daysAgo(300), '5': daysAgo(200) },
          hiscoreEntries: [entry(0, daysAgo(1)), entry(5, daysAgo(9))],
        }),
      ]);

      expect(await drop()).toEqual([
        { username: 'a', dropped: [1, 6] },
        { username: 'b', dropped: [0] },
      ]);

      const a = await stored('a');
      expect(a?.scrapingOffsets).toEqual([0]);
      expect(a?.pausedScrapingOffsets).toEqual([5]);
      expect(a?.hiscoreEntries).toEqual([entry(0, daysAgo(1)), entry(5, daysAgo(9))]);
      const b = await stored('b');
      expect(b?.scrapingOffsets).toEqual([]);
      expect(b?.pausedScrapingOffsets).toEqual([5]);
      expect(b?.hiscoreEntries).toEqual([entry(5, daysAgo(9))]);
    });

    it('gives an offset without a lookup date `now` and keeps it', async () => {
      await MU.col(client).insertMany([
        player('a', {
          scrapingOffsets: [0, 4],
          scrapingOffsetLookups: { '0': daysAgo(200) },
          hiscoreEntries: [entry(0, daysAgo(1)), entry(4, daysAgo(1))],
        }),
        player('b', { scrapingOffsets: [0], hiscoreEntries: [entry(0, daysAgo(1))] }),
      ]);

      expect(await drop()).toEqual([{ username: 'a', dropped: [0] }]);

      expect((await stored('a'))?.scrapingOffsetLookups).toEqual({ '4': NOW });
      const b = await stored('b');
      expect(b?.scrapingOffsets).toEqual([0]);
      expect(b?.scrapingOffsetLookups).toEqual({ '0': NOW });
    });

    it("keeps only the remaining offsets' lookups and no helper fields, and skips players without offsets", async () => {
      const withoutOffsets = player('c', {
        scrapingOffsets: [],
        scrapingOffsetLookups: { '0': daysAgo(300) },
        hiscoreEntries: [entry(0, daysAgo(1))],
      });
      await MU.col(client).insertMany([
        // '9' is an offset the player no longer has
        player('a', { scrapingOffsets: [0], scrapingOffsetLookups: { '0': daysAgo(10), '9': daysAgo(10) } }),
        player('b', { scrapingOffsets: [0, 1], scrapingOffsetLookups: { '0': daysAgo(10), '1': daysAgo(200) } }),
        { ...withoutOffsets },
      ]);

      await drop();

      expect((await stored('a'))?.scrapingOffsetLookups).toEqual({ '0': daysAgo(10) });
      expect((await stored('b'))?.scrapingOffsetLookups).toEqual({ '0': daysAgo(10) });
      expect(await stored('c')).toEqual(withoutOffsets);
      const withHelpers = { $or: ['_lookups', '_keep', '_dropped'].map((field) => ({ [field]: { $exists: true } })) };
      expect(await MU.col(client).countDocuments(withHelpers)).toBe(0);
    });

    it('writes nothing when DRY_RUN is set, but returns what it would drop', async () => {
      await MU.col(client).insertOne(
        player('a', {
          scrapingOffsets: [0, 2],
          scrapingOffsetLookups: { '0': daysAgo(10), '2': daysAgo(200) },
          hiscoreEntries: [entry(0, daysAgo(1)), entry(2, daysAgo(1))],
        }),
      );

      expect(await dryRunWritesNothing(drop)).toEqual([{ username: 'a', dropped: [2] }]);
    });
  });

  describe('pullHiscoreEntriesBefore', () => {
    const date = daysAgo(90);

    beforeEach(async () => {
      await MU.col(client).insertMany([
        player('a', { hiscoreEntries: [entry(0, daysAgo(1)), entry(0, date), entry(0, daysAgo(91))] }),
        player('b', { hiscoreEntries: [entry(0, daysAgo(100))] }),
        player('c', { hiscoreEntries: [entry(0, daysAgo(1))] }),
      ]);
    });

    it('removes the entries older than `date` and counts the players it changed', async () => {
      expect(await MU.pullHiscoreEntriesBefore(client, date)).toBe(2);

      expect((await stored('a'))?.hiscoreEntries).toEqual([entry(0, daysAgo(1)), entry(0, date)]);
      expect((await stored('b'))?.hiscoreEntries).toEqual([]);
      expect((await stored('c'))?.hiscoreEntries).toEqual([entry(0, daysAgo(1))]);
    });

    it('writes nothing when DRY_RUN is set, but counts the players it would change', async () => {
      expect(await dryRunWritesNothing(() => MU.pullHiscoreEntriesBefore(client, date))).toBe(2);
    });
  });

  describe('hasHiscoreEntriesSince', () => {
    it('finds an entry from `date` or later', async () => {
      await MU.col(client).insertOne(player('a', { hiscoreEntries: [entry(0, daysAgo(2)), entry(0, daysAgo(3))] }));

      expect(await MU.hasHiscoreEntriesSince(client, daysAgo(2))).toBe(true);
      expect(await MU.hasHiscoreEntriesSince(client, daysAgo(1))).toBe(false);
    });
  });

  describe('deleteUnusedHiscoreLayouts', () => {
    const layout = (_id: number, since: Date) => ({ _id, since, skills: [], activities: [] });

    beforeEach(async () => {
      await MU.layouts(client).insertMany([
        layout(1, daysAgo(30)),
        layout(2, daysAgo(30)),
        layout(3, subHours(NOW, 12)),
        layout(4, daysAgo(1)),
      ]);
      await MU.col(client).insertOne(player('a', { hiscoreEntries: [entry(0, daysAgo(1), 1)] }));
    });

    it('deletes the layouts no entry uses, except those from the last day', async () => {
      expect(await MU.deleteUnusedHiscoreLayouts(client, NOW)).toBe(1);

      expect(await MU.layouts(client).distinct('_id')).toEqual([1, 3, 4]);
    });

    it('writes nothing when DRY_RUN is set, but counts the layouts it would delete', async () => {
      expect(await dryRunWritesNothing(() => MU.deleteUnusedHiscoreLayouts(client, NOW))).toBe(1);
    });
  });

  describe('deletePlayersWithoutEntries', () => {
    beforeEach(async () => {
      await MU.col(client).insertMany([
        player('a'),
        player('b', { hiscoreEntries: [] }),
        player('c', { hiscoreEntries: [entry(0, daysAgo(1))] }),
      ]);
    });

    it('deletes the players without hiscore entries', async () => {
      expect(await MU.deletePlayersWithoutEntries(client)).toBe(2);

      expect(await usernames()).toEqual(['c']);
    });

    it('writes nothing when DRY_RUN is set, but counts the players it would delete', async () => {
      expect(await dryRunWritesNothing(() => MU.deletePlayersWithoutEntries(client))).toBe(2);
    });
  });
});
