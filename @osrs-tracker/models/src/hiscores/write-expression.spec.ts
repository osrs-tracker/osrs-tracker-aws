import { describe, expect, it } from 'vitest';
import { StoredHiscoreEntry } from '../models/hiscores.js';
import { stripUnchangedValues } from './write-expression.js';

const entry = (
  date: string,
  s: StoredHiscoreEntry['s'],
  a: StoredHiscoreEntry['a'],
  o = 0,
  l = 7,
): StoredHiscoreEntry => ({
  d: new Date(date),
  o,
  l,
  s,
  a,
});

describe('stripUnchangedValues', () => {
  const older = entry(
    '2026-10-01',
    [
      [5, 99, 1000],
      [10, 500],
      [null, 40],
      [3, 70],
    ],
    [
      [1, 20],
      [null, 4],
      [2, 9],
    ],
  );

  it('replaces an equal ranked value by its bare rank', () => {
    const newer = entry(
      '2026-10-02',
      [
        [4, 99, 1010],
        [9, 500],
        [null, 41],
        [3, 80],
      ],
      [
        [1, 20],
        [null, 5],
        [2, 10],
      ],
    );
    expect(stripUnchangedValues(newer, older)).toEqual({
      ...older,
      s: [[5, 99, 1000], 10, [null, 40], [3, 70]],
      a: [1, [null, 4], [2, 9]],
    });
  });

  it('replaces an equal unranked value by 0, even when the newer one is ranked', () => {
    const newer = entry(
      '2026-10-02',
      [
        [5, 99, 1000],
        [10, 501],
        [7, 40],
        [3, 71],
      ],
      [
        [1, 21],
        [null, 4],
        [2, 10],
      ],
    );
    expect(stripUnchangedValues(newer, older)).toEqual({
      ...older,
      s: [[5, 99, 1000], [10, 500], 0, [3, 70]],
      a: [[1, 20], 0, [2, 9]],
    });
  });

  it('keeps changed values', () => {
    const newer = entry(
      '2026-10-02',
      [
        [5, 99, 1001],
        [10, 501],
        [null, 41],
        [3, 71],
      ],
      [
        [1, 21],
        [null, 5],
        [2, 10],
      ],
    );
    expect(stripUnchangedValues(newer, older)).toEqual(older);
  });

  it('keeps null on either side and bare values', () => {
    const withNulls = entry('2026-10-01', [[5, 99, 1000], null, [null, 40], 3], [null, [null, 4], [2, 9]]);
    const newer = entry('2026-10-02', [[5, 99, 1001], null, null, [3, 70]], [null, null, [2, 10]]);
    expect(stripUnchangedValues(newer, withNulls)).toEqual(withNulls);
  });

  it('never strips Overall, but strips index 0 of the activities', () => {
    const newer = entry(
      '2026-10-02',
      [
        [5, 99, 1000],
        [10, 500],
        [null, 40],
        [3, 70],
      ],
      [
        [1, 20],
        [null, 4],
        [2, 9],
      ],
    );
    expect(stripUnchangedValues(newer, older)).toEqual({ ...older, s: [[5, 99, 1000], 10, 0, 3], a: [1, 0, 2] });
  });

  it('handles positions beyond any enum', () => {
    const wide = entry(
      '2026-10-01',
      [[1, 1, 1], ...Array.from({ length: 40 }, (_, i) => [i + 1, i * 10] as [number, number])],
      [],
    );
    const newer = entry(
      '2026-10-02',
      [[1, 1, 2], ...Array.from({ length: 40 }, (_, i) => [i + 2, i * 10] as [number, number])],
      [],
    );
    expect(stripUnchangedValues(newer, wide).s).toEqual([[1, 1, 1], ...Array.from({ length: 40 }, (_, i) => i + 1)]);
  });

  it('returns older unchanged for another offset or layout', () => {
    const same = (o: number, l: number) => entry('2026-10-02', older.s, older.a, o, l);
    expect(stripUnchangedValues(same(1, 7), older)).toBe(older);
    expect(stripUnchangedValues(same(0, 8), older)).toBe(older);
  });

  it('does not mutate its arguments', () => {
    const copy = structuredClone(older);
    stripUnchangedValues(entry('2026-10-02', older.s, older.a), older);
    expect(older).toEqual(copy);
  });
});
