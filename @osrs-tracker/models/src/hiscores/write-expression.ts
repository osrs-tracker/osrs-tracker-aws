import { StoredHiscoreEntry, StoredHiscoreValue } from '../models/hiscores.js';

/*
 * Writing a hiscore entry: prepend the new, full entry and strip the previous one for the same offset.
 *
 * The previous entry is the newest existing entry with the same `o` (entries are newest first, so the first match, at
 * any index). Only when it also has the same `l` (same positions), each of its values except Overall (`s[0]`) whose xp
 * or score equals the new entry's value at the same position becomes its bare rank (`0` when unranked). Only full
 * values on both sides are compared; `null` and bare values stay. Every other entry is untouched, so the newest entry
 * per offset is always full and bare values only point to newer entries.
 *
 * `hiscoreEntriesWriteExpression` does this in MongoDB, `stripUnchangedValues` in TypeScript (for rewriting whole histories);
 * the integration tests check that both agree.
 */

/** The value (xp or score) of a full stored value, `undefined` for `null` and bare values. */
function fullValue(value: StoredHiscoreValue | undefined): number | undefined {
  return Array.isArray(value) ? (value[value.length - 1] as number) : undefined;
}

function stripValues(
  older: StoredHiscoreValue[],
  newer: StoredHiscoreValue[],
  keepFirst: boolean,
): StoredHiscoreValue[] {
  return older.map((value, i) => {
    if (keepFirst && i === 0) return value;
    const olderValue = fullValue(value);
    if (olderValue === undefined || olderValue !== fullValue(newer[i])) return value;
    return (value as [number | null, ...number[]])[0] ?? 0;
  });
}

/**
 * Returns `older` with every value (except Overall) that is unchanged in `newer` replaced by its bare rank (`0` when
 * unranked). Returns `older` unchanged when the two entries have another offset (`o`) or layout (`l`). `newer` must be
 * the next newer entry with the same offset.
 */
export function stripUnchangedValues(newer: StoredHiscoreEntry, older: StoredHiscoreEntry): StoredHiscoreEntry {
  if (newer.o !== older.o || newer.l !== older.l) return older;
  return { ...older, s: stripValues(older.s, newer.s, true), a: stripValues(older.a, newer.a, false) };
}

/**
 * Aggregation expression for `{ s | a }` of `$$prev` stripped against `$$entry`: a value becomes its bare rank when
 * both sides are full and their last element (xp or score) is equal. `keepFirst` keeps Overall.
 */
function stripValuesExpression(key: 's' | 'a', keepFirst: boolean): Record<string, unknown> {
  const unchanged = {
    $cond: [
      { $and: [{ $isArray: '$$old' }, { $isArray: '$$new' }] },
      { $eq: [{ $last: '$$old' }, { $last: '$$new' }] },
      false,
    ],
  };
  return {
    $map: {
      input: { $range: [0, { $size: `$$prev.${key}` }] },
      as: 'p',
      in: {
        $let: {
          vars: { old: { $arrayElemAt: [`$$prev.${key}`, '$$p'] }, new: { $arrayElemAt: [`$$entry.${key}`, '$$p'] } },
          in: {
            $cond: [
              keepFirst ? { $and: [{ $ne: ['$$p', 0] }, unchanged] } : unchanged,
              { $ifNull: [{ $first: '$$old' }, 0] },
              '$$old',
            ],
          },
        },
      },
    },
  };
}

/**
 * Aggregation expression evaluating to the new `hiscoreEntries` array: `entry` (an encoded, full entry) prepended and
 * the previous entry with the same offset stripped (see the rule above). Reads `field` with `$ifNull` (an upsert has
 * none) and wraps `entry` in `$literal`. Use it in a pipeline update, `{ $set: { hiscoreEntries: <expr> } }`, or as a
 * branch of a `$cond` in that `$set`.
 */
export function hiscoreEntriesWriteExpression(
  entry: StoredHiscoreEntry,
  field = '$hiscoreEntries',
): Record<string, unknown> {
  return {
    $let: {
      vars: { entries: { $ifNull: [field, []] }, entry: { $literal: entry } },
      in: {
        $let: {
          // index of the newest existing entry with the same offset, -1 if none
          vars: { i: { $indexOfArray: [{ $map: { input: '$$entries', in: '$$this.o' } }, '$$entry.o'] } },
          in: {
            $concatArrays: [
              ['$$entry'],
              {
                $map: {
                  input: { $range: [0, { $size: '$$entries' }] },
                  as: 'k',
                  in: {
                    $let: {
                      vars: { prev: { $arrayElemAt: ['$$entries', '$$k'] } },
                      in: {
                        $cond: [
                          { $and: [{ $eq: ['$$k', '$$i'] }, { $eq: ['$$prev.l', '$$entry.l'] }] },
                          {
                            $mergeObjects: [
                              '$$prev',
                              { s: stripValuesExpression('s', true), a: stripValuesExpression('a', false) },
                            ],
                          },
                          '$$prev',
                        ],
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
  };
}
