import { describe, expect, it } from 'vitest';
import { decodeHiscoreEntries, type HiscoreLayout, type StoredHiscoreEntry } from '@osrs-tracker/models';
import { migratePlayer, type AnyHiscoreEntry, type PlayerMigration } from './migrate-player.ts';
import { day, jagexFixtures, mapped, NEW_ACTIVITY, oldEntry, oldHistory } from './test-utils.ts';

const fixtures = jagexFixtures();
const labels = Object.keys(fixtures);

type Converted = Extract<PlayerMigration, { status: 'converted' }>;

function convert(stored: readonly AnyHiscoreEntry[], layouts = new Map<number, HiscoreLayout>()): Converted {
  const result = migratePlayer(stored, layouts);
  if (result.status !== 'converted') throw new Error(`Expected converted, got ${JSON.stringify(result)}`);
  return result;
}

function layoutMap(layouts: HiscoreLayout[]): Map<number, HiscoreLayout> {
  return new Map(layouts.map((layout) => [layout._id, layout]));
}

/** How many values of an entry are bare (stored as a rank or 0 because unchanged). */
function bareValues(entry: StoredHiscoreEntry): number {
  return [...entry.s, ...entry.a].filter((value) => typeof value === 'number').length;
}

describe('migratePlayer', () => {
  it.each(labels)('converts an old-format history of %s and decodes to the mapped entries', (label) => {
    const stored = oldHistory(fixtures[label]);
    const result = convert(stored);

    expect(result.oldFormatEntries).toBe(10);
    expect(result.layouts).toHaveLength(1);
    expect(result.layouts[0].since).toEqual(day(0));
    expect(result.hiscoreEntries.map((entry) => entry.d)).toEqual(stored.map((entry) => entry.date));
    expect(decodeHiscoreEntries(result.hiscoreEntries, layoutMap(result.layouts))).toEqual(mapped(stored));
    // the newest entry is full, older ones keep only the rank of unchanged values
    expect(bareValues(result.hiscoreEntries[0])).toBe(0);
    expect(result.hiscoreEntries.slice(1).every((entry) => bareValues(entry) > 0)).toBe(true);
    // Overall is never bare
    expect(result.hiscoreEntries.every((entry) => Array.isArray(entry.s[0]))).toBe(true);
  });

  it('ignores the extra `name` field of entries written by the API', () => {
    const json = fixtures[labels[0]];
    const withName = [oldEntry(json, 1, 0, { name: 'zezima' }), oldEntry(json, 0, 0, { name: 'zezima' })];
    expect(convert(withName).hiscoreEntries).toEqual(convert(oldHistory(json, { to: 1 })).hiscoreEntries);
  });

  it('sorts out-of-order entries newest first before stripping', () => {
    const sorted = oldHistory(fixtures[labels[1]]);
    // an older API appended one newer entry after older ones
    const stored = [...sorted.slice(0, 3), ...sorted.slice(4), sorted[3]];
    const result = convert(stored);

    expect(result.hiscoreEntries.map((entry) => entry.d)).toEqual(sorted.map((entry) => entry.date));
    expect(result.hiscoreEntries).toEqual(convert(sorted).hiscoreEntries);
    expect(decodeHiscoreEntries(result.hiscoreEntries, layoutMap(result.layouts))).toEqual(mapped(sorted));
  });

  it('strips each entry against the next newer entry of the same offset', () => {
    const stored = oldHistory(fixtures[labels[2]], { offsets: [0, -6] });
    const result = convert(stored);

    expect(decodeHiscoreEntries(result.hiscoreEntries, layoutMap(result.layouts))).toEqual(mapped(stored));
    // the newest entry of each offset is full; every other has bare values
    const newest = new Set<number>();
    for (const entry of result.hiscoreEntries) {
      if (newest.has(entry.o)) expect(bareValues(entry)).toBeGreaterThan(0);
      else expect(bareValues(entry)).toBe(0);
      newest.add(entry.o);
    }
    // same as migrating each offset on its own: the other offset never affects stripping
    const byOffset = (o: number) => result.hiscoreEntries.filter((entry) => entry.o === o);
    expect(byOffset(-6)).toEqual(convert(stored.filter((entry) => entry.scrapingOffset === -6)).hiscoreEntries);
    expect(byOffset(0)).toEqual(convert(stored.filter((entry) => entry.scrapingOffset === 0)).hiscoreEntries);
  });

  it('creates a layout per name list with `since` = its oldest entry, for names in neither enum too', () => {
    const stored = oldHistory(fixtures[labels[3]], { newActivityFrom: 6 });
    const result = convert(stored);

    expect(result.layouts.map((layout) => [layout.activities.includes(NEW_ACTIVITY), layout.since])).toEqual([
      [true, day(6)],
      [false, day(0)],
    ]);
    const decoded = decodeHiscoreEntries(result.hiscoreEntries, layoutMap(result.layouts));
    expect(decoded).toEqual(mapped(stored));
    expect(decoded[0].activities[NEW_ACTIVITY]).toEqual({ rank: 59, score: 9 });
  });

  it('converts a mixed document: new-format entries plus old-format ones the old API wrote later', () => {
    const json = fixtures[labels[0]];
    const migratedEarlier = convert(oldHistory(json, { to: 7, offsets: [0, -6] }));
    const layouts = layoutMap(migratedEarlier.layouts);
    // the old API prepends its initial entries (another offset too) after the first run
    const writtenLater = [oldEntry(json, 9, 0), oldEntry(json, 8, 3), oldEntry(json, 8, 0)];
    const stored: AnyHiscoreEntry[] = [...writtenLater, ...migratedEarlier.hiscoreEntries];

    const result = convert(stored, layouts);

    expect(result.oldFormatEntries).toBe(3);
    const all = [...writtenLater, ...oldHistory(json, { to: 7, offsets: [0, -6] })];
    expect(decodeHiscoreEntries(result.hiscoreEntries, layoutMap(result.layouts))).toEqual(mapped(all));
    expect(result.hiscoreEntries).toEqual(convert(all).hiscoreEntries);
    expect(result.layouts[0].since).toEqual(day(0, -6));
  });

  it('skips a player whose entries are all in the new format and already stripped', () => {
    const migrated = convert(oldHistory(fixtures[labels[1]], { offsets: [0, 2], newActivityFrom: 5 }));
    expect(migratePlayer(migrated.hiscoreEntries, layoutMap(migrated.layouts))).toEqual({ status: 'skipped' });
  });

  it('fails without a result when the check finds a difference (a corrupted layout)', () => {
    const stored = oldHistory(fixtures[labels[2]]);
    const { layouts } = convert(stored);
    // the stored layout with this id lists two activities with different values the other way round
    const newest = mapped(stored)[0].activities;
    const corrupt = { ...layouts[0], activities: [...layouts[0].activities] };
    const i = corrupt.activities.findIndex((name) => newest[name] !== null);
    const k = corrupt.activities.findIndex((name) => newest[name] === null);
    [corrupt.activities[i], corrupt.activities[k]] = [corrupt.activities[k], corrupt.activities[i]];

    const result = migratePlayer(stored, layoutMap([corrupt]));

    expect(result).toMatchObject({
      status: 'failed',
      reason: expect.stringContaining('Check: the new entry decodes differently: activities.'),
      entry: { index: 0, date: day(9), scrapingOffset: 0 },
    });
    expect(result).not.toHaveProperty('hiscoreEntries');
  });

  it('fails for a new-format entry with an unknown layout, and for an entry of unknown shape', () => {
    const migrated = convert(oldHistory(fixtures[labels[0]]));
    expect(migratePlayer(migrated.hiscoreEntries, new Map())).toMatchObject({
      status: 'failed',
      reason: expect.stringContaining('Unknown hiscore layout'),
    });
    expect(migratePlayer([{ foo: 1 } as unknown as AnyHiscoreEntry], new Map())).toMatchObject({
      status: 'failed',
      reason: 'Entry 0 has an unknown shape (keys: foo)',
    });
  });
});
