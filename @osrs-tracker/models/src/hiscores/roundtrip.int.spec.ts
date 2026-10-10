import { Collection, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HiscoreEntry, HiscoreLayout, StoredHiscoreEntry } from '../models/hiscores.js';
import { levelForXp } from '../xp/levels.js';
import { decodeHiscoreEntries, encodeHiscoreEntry } from './codec.js';
import { codecFixtures, day, nextEntry } from './codec.test-utils.js';
import { createHiscoreLayout } from './layout.js';
import { hiscoreEntriesWriteExpression } from './write-expression.js';

/** Production runs MongoDB 8.0 (Atlas). */
const MONGODB_VERSION = '8.0.12';
const DAYS = 15;
/** From this day on, Jagex lists one more activity: a new layout. */
const LAYOUT_CHANGE_DAY = 10;
const NEW_ACTIVITY = 'A Boss In Neither Enum';

interface Doc {
  _id: string;
  hiscoreEntries?: StoredHiscoreEntry[];
}

/**
 * The whole chain on real data: domain entries are encoded, written one by one with the write expression (prepend and
 * strip), read back and decoded. The result must equal what was written, also after the oldest entries are pulled
 * the way clean-hiscores does.
 */
describe('encode → write expression → decode (MongoDB)', () => {
  let server: MongoMemoryServer;
  let client: MongoClient;
  let players: Collection<Doc>;

  beforeAll(async () => {
    server = await MongoMemoryServer.create({ binary: { version: MONGODB_VERSION } });
    client = await MongoClient.connect(server.getUri());
    players = client.db('test').collection<Doc>('players');
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    await server?.stop();
  });

  for (const [label, fixture] of Object.entries(codecFixtures())) {
    it(`round-trips a ${DAYS}-day history of ${label} on two offsets and a layout change`, async () => {
      const oldLayout = createHiscoreLayout(fixture.layout, day(0));
      const newLayout = createHiscoreLayout(
        { skills: fixture.layout.skills, activities: [...fixture.layout.activities, NEW_ACTIVITY] },
        day(LAYOUT_CHANGE_DAY),
      );
      const layouts = new Map<number, HiscoreLayout>([
        [oldLayout._id, oldLayout],
        [newLayout._id, newLayout],
      ]);

      const written: HiscoreEntry[] = [];
      for (const offset of [0, -6]) {
        let entry: HiscoreEntry = {
          date: day(0, offset),
          scrapingOffset: offset,
          skills: fixture.skills,
          activities: fixture.activities,
        };
        for (let n = 0; n < DAYS; n++) {
          if (n > 0) entry = nextEntry(entry, day(n, offset), changesOn(n, entry));
          written.push(entry);
        }
      }
      // write in time order, the offsets interleaved, as process-players and the API do
      written.sort((a, b) => a.date.getTime() - b.date.getTime());
      for (const entry of written) {
        const layout = NEW_ACTIVITY in entry.activities ? newLayout : oldLayout;
        await players.updateOne(
          { _id: label },
          [{ $set: { hiscoreEntries: hiscoreEntriesWriteExpression(encodeHiscoreEntry(entry, layout)) } }],
          { upsert: true },
        );
      }

      const stored = (await players.findOne({ _id: label }))!.hiscoreEntries!;
      const newestFirst = [...written].reverse();
      expect(stored.some((entry) => entry.s.some((value) => typeof value === 'number'))).toBe(true);
      expect(decodeHiscoreEntries(stored, layouts)).toEqual(newestFirst);

      // clean-hiscores pulls the oldest entries; bare values only point to newer ones
      const cutoff = day(5);
      await players.updateOne({ _id: label }, { $pull: { hiscoreEntries: { d: { $lt: cutoff } } } });
      const cleaned = (await players.findOne({ _id: label }))!.hiscoreEntries!;
      expect(decodeHiscoreEntries(cleaned, layouts)).toEqual(newestFirst.filter((entry) => entry.date >= cutoff));
    });
  }
});

/** Ranks move every day; some xp and scores change on some days; the new activity appears with the new layout. */
function changesOn(n: number, entry: HiscoreEntry): Parameters<typeof nextEntry>[2] {
  const skills: HiscoreEntry['skills'] = {};
  const activities: HiscoreEntry['activities'] = {};
  const attack = entry.skills['Attack'];
  if (n % 3 === 0 && attack && attack.xp < 200_000_000) {
    const xp = Math.min(attack.xp + 25_000, 200_000_000);
    skills['Attack'] = { ...attack, xp, level: levelForXp(xp) };
  }
  const zulrah = entry.activities['Zulrah'];
  if (n % 4 === 0) activities['Zulrah'] = { rank: zulrah?.rank ?? null, score: (zulrah?.score ?? 0) + 3 };
  if (n === LAYOUT_CHANGE_DAY) activities[NEW_ACTIVITY] = { rank: null, score: 1 };
  if (n > LAYOUT_CHANGE_DAY) activities[NEW_ACTIVITY] = { rank: null, score: n === DAYS - 1 ? 2 : 1 };
  return { rankShift: n % 2 ? -1 : 2, skills, activities };
}
