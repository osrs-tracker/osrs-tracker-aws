import { createHiscoreLayout, StoredHiscoreEntry, StoredPlayer } from '@osrs-tracker/models';
import { subDays } from 'date-fns';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HISCORE_NOT_FOUND_PAUSE_DAYS, MU } from './mongo.utils';

/** Production runs MongoDB 8.0 (Atlas), as in @osrs-tracker/models' integration tests. */
const MONGODB_VERSION = '8.0.12';

const now = new Date('2026-10-14T12:00:00Z');

describe('MU (MongoDB)', () => {
  let server: MongoMemoryServer;
  let client: MongoClient;

  beforeAll(async () => {
    server = await MongoMemoryServer.create({ binary: { version: MONGODB_VERSION } });
    client = await MongoClient.connect(server.getUri());
    // the writes hint this index (the API owns it, see DATA-MODEL.md)
    await MU.col(client).createIndex({ username: 1 }, { unique: true });
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    await MU.col(client).deleteMany({});
    await MU.layouts(client).deleteMany({});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  // only the fields these writes read
  const insert = (player: Partial<StoredPlayer>) =>
    MU.col(client).insertOne({ username: 'alice', ...player } as StoredPlayer);
  const stored = (username = 'alice') => MU.col(client).findOne({ username }, { projection: { _id: 0 } });

  describe('recordHiscoreNotFound', () => {
    it('starts a streak', async () => {
      await insert({ scrapingOffsets: [1] });

      expect(await MU.recordHiscoreNotFound(client, 'alice', now)).toBe(false);
      expect(await stored()).toEqual({
        username: 'alice',
        scrapingOffsets: [1],
        hiscoreNotFoundSince: now,
        hiscoreNotFoundCount: 1,
      });
    });

    it('continues a streak from its start', async () => {
      await insert({ scrapingOffsets: [1], hiscoreNotFoundSince: subDays(now, 3), hiscoreNotFoundCount: 3 });

      expect(await MU.recordHiscoreNotFound(client, 'alice', now)).toBe(false);
      expect(await stored()).toMatchObject({
        scrapingOffsets: [1],
        hiscoreNotFoundSince: subDays(now, 3),
        hiscoreNotFoundCount: 4,
      });
    });

    it(`doesn't pause a streak that is ${HISCORE_NOT_FOUND_PAUSE_DAYS - 1} days old`, async () => {
      await insert({ scrapingOffsets: [1], hiscoreNotFoundSince: subDays(now, HISCORE_NOT_FOUND_PAUSE_DAYS - 1) });

      expect(await MU.recordHiscoreNotFound(client, 'alice', now)).toBe(false);
      expect(await stored()).toMatchObject({ scrapingOffsets: [1] });
    });

    it(`pauses scraping once the streak is ${HISCORE_NOT_FOUND_PAUSE_DAYS} days old`, async () => {
      await insert({
        scrapingOffsets: [1, 5],
        pausedScrapingOffsets: [5, 9],
        hiscoreNotFoundSince: subDays(now, HISCORE_NOT_FOUND_PAUSE_DAYS),
        hiscoreNotFoundCount: 7,
      });

      expect(await MU.recordHiscoreNotFound(client, 'alice', now)).toBe(true);
      const player = await stored();
      expect(player).not.toHaveProperty('scrapingOffsets');
      expect(player?.pausedScrapingOffsets?.sort()).toEqual([1, 5, 9]);
      expect(player?.hiscoreNotFoundCount).toBe(8);
    });

    it.each([{ scrapingOffsets: [] }, {}])(
      "doesn't pause again when no scrapingOffsets are left (%j)",
      async (offsets) => {
        await insert({ ...offsets, pausedScrapingOffsets: [1], hiscoreNotFoundSince: subDays(now, 30) });

        expect(await MU.recordHiscoreNotFound(client, 'alice', now)).toBe(false);
        expect(await stored()).toMatchObject({ ...offsets, pausedScrapingOffsets: [1], hiscoreNotFoundCount: 1 });
      },
    );

    it('changes nothing for an unknown player', async () => {
      expect(await MU.recordHiscoreNotFound(client, 'alice', now)).toBe(false);
      expect(await MU.col(client).countDocuments()).toBe(0);
    });
  });

  describe('bulkWrite of hiscoreEntryBulkWriteOp', () => {
    it('prepends the entry and ends the streak', async () => {
      const older: StoredHiscoreEntry = { d: subDays(now, 1), o: 0, l: 1, s: [[1, 99, 13_034_431]], a: [] };
      const entry: StoredHiscoreEntry = { d: now, o: 1, l: 1, s: [[1, 99, 14_000_000]], a: [] };
      await insert({ hiscoreEntries: [older], hiscoreNotFoundSince: subDays(now, 3), hiscoreNotFoundCount: 3 });

      expect(await MU.bulkWrite(client, [MU.hiscoreEntryBulkWriteOp('alice', entry)])).toBe(1);
      expect(await stored()).toEqual({ username: 'alice', hiscoreEntries: [entry, older] });
    });
  });

  describe('ensureHiscoreLayouts', () => {
    const storedLayout = (_id: number) => MU.layouts(client).findOne({ _id });

    it('stores a new layout', async () => {
      const layout = createHiscoreLayout({ skills: ['Overall', 'Attack'], activities: [] }, now);

      await MU.ensureHiscoreLayouts(client, [layout]);
      expect(await storedLayout(layout._id)).toEqual(layout);
    });

    it('keeps a stored layout with the same names', async () => {
      const layout = createHiscoreLayout({ skills: ['Overall', 'Defence'], activities: [] }, now);
      await MU.layouts(client).insertOne({ ...layout, since: subDays(now, 100) });

      await MU.ensureHiscoreLayouts(client, [layout]);
      expect(await storedLayout(layout._id)).toEqual({ ...layout, since: subDays(now, 100) });
    });

    it('throws when its id is stored with other names (a layout id hash collision)', async () => {
      const layout = createHiscoreLayout({ skills: ['Overall', 'Strength'], activities: [] }, now);
      await MU.layouts(client).insertOne({ ...layout, skills: ['Overall', 'Hitpoints'] });

      await expect(MU.ensureHiscoreLayouts(client, [layout])).rejects.toThrow(
        `Hiscore layout ${layout._id} is stored with other names (a layout id hash collision)`,
      );
    });
  });
});
