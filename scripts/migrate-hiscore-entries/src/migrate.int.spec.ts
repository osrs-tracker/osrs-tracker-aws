import { MongoClient, type Collection, type Db } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createHiscoreLayout,
  decodeHiscoreEntries,
  encodeHiscoreEntry,
  hiscoreEntriesWriteExpression,
  type HiscoreLayout,
  type StoredHiscoreEntry,
} from '@osrs-tracker/models';
import { fromJagex } from '@osrs-tracker/hiscores';
import { LAYOUTS_COLLECTION, migrate, type MigrateOptions, type PlayerDoc } from './migrate.ts';
import { migratePlayer, type AnyHiscoreEntry, type OldHiscoreEntry } from './migrate-player.ts';
import { jagexFixtures, mapped, oldEntry, oldHistory } from './test-utils.ts';

/** Production runs MongoDB 8.0 (Atlas). */
const MONGODB_VERSION = '8.0.12';

const fixtures = jagexFixtures();
const [b0aty, ironMammal, lynxTitan, zezima] = Object.keys(fixtures).map((label) => fixtures[label]);

/** Every player's old-format entries, the expected result once decoded. */
const histories: Record<string, OldHiscoreEntry[]> = {
  'old only': oldHistory(b0aty),
  'out of order': (() => {
    const sorted = oldHistory(ironMammal, { to: 6 });
    return [...sorted.slice(0, 2), ...sorted.slice(3), sorted[2]];
  })(),
  'two offsets and a new layout': oldHistory(lynxTitan, { offsets: [0, -6], newActivityFrom: 5 }),
  'mixed': oldHistory(zezima, { offsets: [0, 3] }),
};

describe('migrate (MongoDB)', () => {
  let server: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let players: Collection<PlayerDoc>;
  let layouts: Collection<HiscoreLayout>;

  const run = (options: Partial<MigrateOptions> = {}) => migrate(players, layouts, { write: false, ...options });
  const snapshot = async () => ({
    players: await players.find({}, { sort: { username: 1 } }).toArray(),
    layouts: await layouts.find({}, { sort: { _id: 1 } }).toArray(),
  });

  beforeAll(async () => {
    server = await MongoMemoryServer.create({ binary: { version: MONGODB_VERSION } });
    client = await MongoClient.connect(server.getUri());
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    db = client.db(`test-${Date.now()}`);
    players = db.collection<PlayerDoc>('players');
    layouts = db.collection<HiscoreLayout>(LAYOUTS_COLLECTION);
    await players.createIndex({ username: 1 }, { unique: true });

    // the mixed player: its older entries were migrated by an earlier run (layout stored), the old API then
    // prepended old-format initial entries
    const mixed = histories['mixed'];
    const writtenLater = mixed.filter((entry) => entry.date >= oldEntry(zezima, 8).date);
    const earlier = migratePlayer(
      mixed.filter((entry) => !writtenLater.includes(entry)),
      new Map(),
    );
    if (earlier.status !== 'converted') throw new Error('Seeding the mixed player failed');
    await layouts.insertMany(earlier.layouts);

    await players.insertMany([
      ...Object.entries(histories)
        .filter(([username]) => username !== 'mixed')
        .map(([username, hiscoreEntries]) => ({ username, hiscoreEntries })),
      { username: 'mixed', hiscoreEntries: [...writtenLater, ...earlier.hiscoreEntries] },
      { username: 'never tracked' },
      { username: 'no entries', hiscoreEntries: [] },
    ]);
  });

  it('only reads in a dry run', async () => {
    const before = await snapshot();
    const report = await run();

    expect(await snapshot()).toEqual(before);
    expect(report.players).toEqual({ seen: 4, converted: 4, skipped: 0, failed: 0 });
    expect(report.layouts).toEqual({ existing: 1, created: 1 });
    expect(report.bytes.after).toBeLessThan(report.bytes.before);
  });

  it('writes entries that decode to the mapped originals, stores the layouts, and is idempotent', async () => {
    const report = await run({ write: true });

    expect(report.players).toEqual({ seen: 4, converted: 4, skipped: 0, failed: 0 });
    expect(report.entries.converted).toBe(Object.values(histories).flat().length);
    expect(report.failures).toEqual([]);

    const stored = new Map((await layouts.find().toArray()).map((layout) => [layout._id, layout]));
    expect(stored.size).toBe(2);
    for (const [username, history] of Object.entries(histories)) {
      const player = await players.findOne({ username });
      const entries = player!.hiscoreEntries as StoredHiscoreEntry[];
      expect(decodeHiscoreEntries(entries, stored), username).toEqual(mapped(history));
    }
    // `since` is the oldest entry using the layout, over all players
    const oldest = Object.values(histories)
      .flat()
      .reduce((a, b) => (a.date < b.date ? a : b));
    expect(Math.min(...[...stored.values()].map((layout) => layout.since.getTime()))).toBe(oldest.date.getTime());

    const after = await snapshot();
    const again = await run({ write: true });
    expect(again.players).toEqual({ seen: 4, converted: 0, skipped: 4, failed: 0 });
    expect(again.bytes.after).toBe(report.bytes.after);
    expect(await snapshot()).toEqual(after);
  });

  it('stores what the write expression stores when the entries are written one by one', async () => {
    await run({ write: true, player: 'two offsets and a new layout' });
    const migrated = (await players.findOne({ username: 'two offsets and a new layout' }))!.hiscoreEntries;

    const history = histories['two offsets and a new layout'];
    for (const entry of [...history].reverse()) {
      const { skills, activities, layout } = fromJagex({ name: '', ...entry });
      const encoded = encodeHiscoreEntry(
        { date: entry.date, scrapingOffset: entry.scrapingOffset, skills, activities },
        createHiscoreLayout(layout, entry.date),
      );
      await players.updateOne(
        { username: 'written one by one' },
        [{ $set: { hiscoreEntries: hiscoreEntriesWriteExpression(encoded) } }],
        { upsert: true },
      );
    }

    expect((await players.findOne({ username: 'written one by one' }))!.hiscoreEntries).toEqual(migrated);
  });

  it('writes nothing for a player that fails and continues with the next, with --limit and --player', async () => {
    const unknownLayout: AnyHiscoreEntry = { d: new Date(), o: 0, l: 12345, s: [[1, 2, 3]], a: [] };
    await players.insertOne({ username: 'broken', hiscoreEntries: [unknownLayout] });
    const before = await players.findOne({ username: 'broken' });

    const report = await run({ write: true });

    expect(report.players).toEqual({ seen: 5, converted: 4, skipped: 0, failed: 1 });
    expect(report.failures).toEqual([{ username: 'broken', reason: 'Unknown hiscore layout 12345' }]);
    expect(await players.findOne({ username: 'broken' })).toEqual(before);

    expect((await run({ player: 'broken' })).players.seen).toBe(1);
    expect((await run({ limit: 2 })).players.seen).toBe(2);
  });
});
