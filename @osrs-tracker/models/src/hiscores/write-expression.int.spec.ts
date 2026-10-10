import { Collection, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { StoredHiscoreEntry } from '../models/hiscores.js';
import { hiscoreEntriesWriteExpression, stripUnchangedValues } from './write-expression.js';

/** Production runs MongoDB 8.0 (Atlas). */
const MONGODB_VERSION = '8.0.12';

interface Doc {
  _id: string;
  scrapingOffsets?: number[];
  hiscoreEntries?: StoredHiscoreEntry[];
}

/** The write rule in TypeScript: prepend, strip the newest entry with the same offset. */
function applyInTs(entries: StoredHiscoreEntry[] | undefined, entry: StoredHiscoreEntry): StoredHiscoreEntry[] {
  const old = entries ?? [];
  const i = old.findIndex((e) => e.o === entry.o);
  return [entry, ...old.map((e, k) => (k === i ? stripUnchangedValues(entry, e) : e))];
}

const entry = (
  date: string,
  s: StoredHiscoreEntry['s'],
  a: StoredHiscoreEntry['a'],
  o = 0,
  l = 7,
): StoredHiscoreEntry => ({ d: new Date(`${date}T00:00:00Z`), o, l, s, a });

describe('hiscoreEntriesWriteExpression (MongoDB)', () => {
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

  beforeEach(async () => {
    await players.deleteMany({});
  });

  const write = (newEntry: StoredHiscoreEntry, _id = 'p') =>
    players.updateOne({ _id }, [{ $set: { hiscoreEntries: hiscoreEntriesWriteExpression(newEntry) } }], {
      upsert: true,
    });

  const stored = async (_id = 'p') => (await players.findOne({ _id }))?.hiscoreEntries;

  /** Seeds `entries`, writes `newEntry`, and checks the result against the TypeScript rule. */
  async function writeAndCompare(entries: StoredHiscoreEntry[] | undefined, newEntry: StoredHiscoreEntry) {
    await players.insertOne(entries ? { _id: 'p', hiscoreEntries: entries } : { _id: 'p' });
    await write(newEntry);
    const result = await stored();
    expect(result).toEqual(applyInTs(entries, newEntry));
    return result!;
  }

  it(`runs on MongoDB ${MONGODB_VERSION}`, async () => {
    expect((await client.db('admin').command({ buildInfo: 1 })).version).toBe(MONGODB_VERSION);
  });

  it('upserts the first entry on a document without the field, with a BSON date', async () => {
    const first = entry(
      '2026-10-01',
      [
        [5, 99, 1000],
        [10, 500],
      ],
      [[1, 20]],
    );
    await write(first);
    const result = await stored();
    expect(result).toEqual([first]);
    expect(result![0].d).toBeInstanceOf(Date);
    expect(applyInTs(undefined, first)).toEqual(result);

    await players.deleteMany({});
    expect(await writeAndCompare(undefined, first)).toEqual([first]);
  });

  it('prepends and strips unchanged values, keeping Overall and changed values', async () => {
    const older = entry(
      '2026-10-01',
      [
        [5, 99, 1000],
        [10, 500],
        [11, 600],
      ],
      [
        [1, 20],
        [2, 30],
      ],
    );
    const newer = entry(
      '2026-10-02',
      [
        [5, 99, 1000],
        [10, 500],
        [12, 601],
      ],
      [
        [1, 20],
        [3, 31],
      ],
    );
    const result = await writeAndCompare([older], newer);
    expect(result).toEqual([newer, { ...older, s: [[5, 99, 1000], 10, [11, 600]], a: [1, [2, 30]] }]);
    result.forEach((e) => expect(e.d).toBeInstanceOf(Date));
  });

  it('strips unranked values to 0 and keeps null and bare values', async () => {
    const older = entry('2026-10-01', [[null, 30, 5000], [null, 40], null, 7], [[null, 4], null, 0]);
    const newer = entry(
      '2026-10-02',
      [[null, 30, 5000], [null, 40], null, [7, 70]],
      [
        [null, 4],
        [5, 1],
        [null, 2],
      ],
    );
    const result = await writeAndCompare([older], newer);
    expect(result[1]).toEqual({ ...older, s: [[null, 30, 5000], 0, null, 7], a: [0, null, 0] });
  });

  it('values that look like operators are stored as is', async () => {
    const older = { ...entry('2026-10-01', [[1, 1, 1]], []), extra: '$hiscoreEntries' } as StoredHiscoreEntry;
    const newer = { ...entry('2026-10-02', [[1, 1, 2]], []), extra: '$$ROOT' } as StoredHiscoreEntry;
    await writeAndCompare([older], newer);
  });

  it('does not strip across a layout change', async () => {
    const older = entry(
      '2026-10-01',
      [
        [5, 99, 1000],
        [10, 500],
      ],
      [[1, 20]],
      0,
      7,
    );
    const newer = entry(
      '2026-10-02',
      [
        [5, 99, 1000],
        [10, 500],
      ],
      [[1, 20]],
      0,
      8,
    );
    expect(await writeAndCompare([older], newer)).toEqual([newer, older]);
  });

  it('strips the newest entry with the same offset when it is not at index 0', async () => {
    const s = (xp: number): StoredHiscoreEntry['s'] => [
      [5, 99, xp],
      [10, 500],
    ];
    const entries = [
      entry('2026-10-01', s(30), [[1, 20]], 3),
      entry('2026-10-01', s(20), [[1, 20]], -2),
      entry('2026-10-01', s(10), [[1, 20]], 0),
      entry(
        '2026-09-30',
        [
          [5, 99, 9],
          [10, 499],
        ],
        [[1, 19]],
        0,
      ),
    ];
    const newer = entry('2026-10-02', s(11), [[2, 20]], 0);
    const result = await writeAndCompare(entries, newer);
    expect(result).toEqual([
      newer,
      entries[0],
      entries[1],
      { ...entries[2], s: [[5, 99, 10], 10], a: [1] },
      entries[3],
    ]);
  });

  it('strips nothing when the newest same-offset entry has another layout, even if an older one matches', async () => {
    const entries = [
      entry(
        '2026-10-01',
        [
          [5, 99, 10],
          [10, 500],
        ],
        [[1, 20]],
        0,
        8,
      ),
      entry(
        '2026-09-30',
        [
          [5, 99, 10],
          [10, 500],
        ],
        [[1, 20]],
        0,
        7,
      ),
    ];
    const newer = entry(
      '2026-10-02',
      [
        [5, 99, 10],
        [10, 500],
      ],
      [[1, 20]],
      0,
      7,
    );
    expect(await writeAndCompare(entries, newer)).toEqual([newer, ...entries]);
  });

  it("works as the else branch of the API's $cond", async () => {
    const older = entry(
      '2026-10-01',
      [
        [5, 99, 1000],
        [10, 500],
      ],
      [[1, 20]],
      2,
    );
    const newer = entry(
      '2026-10-02',
      [
        [5, 99, 1001],
        [10, 500],
      ],
      [[1, 20]],
      2,
    );
    const apiUpdate = (offset: number) => [
      {
        $set: {
          hiscoreEntries: {
            $cond: [
              { $in: [offset, { $ifNull: ['$scrapingOffsets', []] }] },
              '$hiscoreEntries',
              hiscoreEntriesWriteExpression(newer),
            ],
          },
          scrapingOffsets: { $setUnion: [{ $ifNull: ['$scrapingOffsets', []] }, [offset]] },
        },
      },
    ];

    await players.insertOne({ _id: 'p', scrapingOffsets: [2], hiscoreEntries: [older] });
    await players.updateOne({ _id: 'p' }, apiUpdate(2));
    expect(await stored()).toEqual([older]);

    await players.updateOne({ _id: 'p' }, [{ $set: { scrapingOffsets: [] } }]);
    await players.updateOne({ _id: 'p' }, apiUpdate(2));
    const doc = await players.findOne({ _id: 'p' });
    expect(doc?.scrapingOffsets).toEqual([2]);
    expect(doc?.hiscoreEntries).toEqual(applyInTs([older], newer));
    expect(doc?.hiscoreEntries).toEqual([newer, { ...older, a: [1], s: [[5, 99, 1000], 10] }]);

    await players.updateOne({ _id: 'q' }, apiUpdate(2), { upsert: true });
    expect(await players.findOne({ _id: 'q' })).toEqual({ _id: 'q', scrapingOffsets: [2], hiscoreEntries: [newer] });
  });

  it('two concurrent writers give the result of one of the two orders', async () => {
    const older = entry(
      '2026-10-01',
      [
        [5, 99, 1000],
        [10, 500],
        [11, 600],
      ],
      [[1, 20]],
    );
    const a = entry(
      '2026-10-02',
      [
        [5, 99, 1000],
        [10, 500],
        [12, 601],
      ],
      [[1, 20]],
    );
    const b = entry(
      '2026-10-03',
      [
        [5, 99, 1002],
        [10, 500],
        [12, 601],
      ],
      [[2, 21]],
    );

    for (let run = 0; run < 20; run++) {
      await players.deleteMany({});
      await players.insertOne({ _id: 'p', hiscoreEntries: [older] });
      await Promise.all([write(a), write(b)]);
      const result = await stored();
      expect([applyInTs(applyInTs([older], a), b), applyInTs(applyInTs([older], b), a)]).toContainEqual(result);
      expect(result).toHaveLength(3);
      expect(result!.filter((e) => e.s.every((v) => Array.isArray(v) || v === null))).toHaveLength(1);
    }
  });

  it('agrees with stripUnchangedValues over a history of writes', async () => {
    let expected: StoredHiscoreEntry[] | undefined;
    const layouts = [7, 7, 7, 8, 8, 8];
    for (let day = 1; day <= 12; day++) {
      const o = day % 2 === 0 ? 0 : -5;
      const l = layouts[Math.floor((day - 1) / 2)];
      const s = Array.from({ length: 30 }, (_, p) =>
        p === 0
          ? ([null, 50, 1000 + day] as [null, number, number])
          : p % 7 === 0
            ? null
            : ([p % 3 ? p : null, 100 + Math.floor(day / ((p % 4) + 1))] as [number | null, number]),
      );
      const a = Array.from({ length: 12 }, (_, p) =>
        p % 5 === 0 ? null : ([p, Math.floor(day / p)] as [number, number]),
      );
      const newEntry = entry(`2026-10-${String(day).padStart(2, '0')}`, s, a, o, l);
      await write(newEntry);
      expected = applyInTs(expected, newEntry);
      expect(await stored()).toEqual(expected);
    }
  });
});
