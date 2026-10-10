import { isDeepStrictEqual } from 'node:util';
import { fromJagex, type JagexHiscoreJson } from '@osrs-tracker/hiscores';
import {
  createHiscoreLayout,
  decodeHiscoreEntries,
  encodeHiscoreEntry,
  layoutId,
  stripUnchangedValues,
  type HiscoreEntry,
  type HiscoreLayout,
  type HiscoreLayoutNames,
  type StoredHiscoreEntry,
} from '@osrs-tracker/models';

/** An entry as stored before the compact format: Jagex's JSON plus the scrape's date and offset (`name` is ignored). */
export interface OldHiscoreEntry {
  date: Date;
  scrapingOffset: number;
  skills: JagexHiscoreJson['skills'];
  activities: JagexHiscoreJson['activities'];
  name?: string;
}

/** What `players.hiscoreEntries` can hold during the migration: either format, mixed in one array. */
export type AnyHiscoreEntry = OldHiscoreEntry | StoredHiscoreEntry;

/** Where a check failure was found: the position in the new (date-sorted) array and the entry's date and offset. */
export interface FailedEntry {
  index: number;
  date: Date;
  scrapingOffset: number;
}

export type PlayerMigration =
  /** All entries are in the new format and already stripped: nothing to write. */
  | { status: 'skipped' }
  | {
      status: 'converted';
      /** The new `hiscoreEntries`, newest first. */
      hiscoreEntries: StoredHiscoreEntry[];
      /** The layouts the entries use, `since` = the oldest entry of this player using it. Upsert before the entries. */
      layouts: HiscoreLayout[];
      /** Entries that were in the old format. */
      oldFormatEntries: number;
    }
  /** Nothing may be written for this player. */
  | { status: 'failed'; reason: string; entry?: FailedEntry };

export function isStoredEntry(entry: AnyHiscoreEntry): entry is StoredHiscoreEntry {
  return 'd' in entry;
}

/** A domain entry and the names of the layout it is encoded with. */
interface Mapped {
  entry: HiscoreEntry;
  names: HiscoreLayoutNames;
}

/**
 * Rewrites one player's stored entries (any mix of old Jagex-shaped and new entries) to the compact format, the way
 * the write expression would have stored them one by one:
 *
 * 1. new-format entries are decoded (with `layouts`, in array order), old ones mapped with hiscores' `fromJagex`;
 * 2. all are sorted newest first by date (some old entries are out of order, and bare values follow array order);
 * 3. each is encoded in full with its layout (`since` = the oldest entry using it), then stripped against the next
 *    newer entry with the same offset with models' `stripUnchangedValues`, as the write expression does;
 * 4. the result is decoded again (layouts from `layouts` take precedence: they are what readers will load) and must
 *    deep-equal the mapped entries, levels included.
 *
 * Never throws: any error, such as an unknown layout or an entry of an unknown shape, is a `failed` result.
 */
export function migratePlayer(
  stored: readonly AnyHiscoreEntry[],
  layouts: ReadonlyMap<number, HiscoreLayout>,
): PlayerMigration {
  try {
    return migrate(stored, layouts);
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}

function migrate(stored: readonly AnyHiscoreEntry[], layouts: ReadonlyMap<number, HiscoreLayout>): PlayerMigration {
  stored.forEach(assertKnownShape);
  const newFormat = stored.filter(isStoredEntry);
  const oldFormat = stored.filter((entry): entry is OldHiscoreEntry => !isStoredEntry(entry));

  // Bare values point to the next newer new-format entry in array order: the write expression never matched an
  // old-format entry (it has no `o`), so the new-format entries decode on their own.
  const decoded = decodeHiscoreEntries(newFormat, layouts);
  const mapped: Mapped[] = [
    ...decoded.map((entry, i): Mapped => ({ entry, names: layouts.get(newFormat[i].l)! })),
    ...oldFormat.map((old): Mapped => {
      const { skills, activities, layout } = fromJagex({ name: '', skills: old.skills, activities: old.activities });
      return { entry: { date: old.date, scrapingOffset: old.scrapingOffset, skills, activities }, names: layout };
    }),
  ];
  // stable: entries with the same date keep their relative order
  mapped.sort((a, b) => b.entry.date.getTime() - a.entry.date.getTime());

  const needed = new Map<number, HiscoreLayout>();
  for (const { entry, names } of mapped) {
    const id = layoutId(names.skills, names.activities);
    const layout = needed.get(id);
    if (!layout) needed.set(id, createHiscoreLayout(names, entry.date));
    else if (entry.date < layout.since) layout.since = entry.date;
  }

  const encoded = mapped.map(({ entry, names }) =>
    encodeHiscoreEntry(entry, needed.get(layoutId(names.skills, names.activities))!),
  );
  const newerFullByOffset = new Map<number, StoredHiscoreEntry>();
  const hiscoreEntries = encoded.map((entry) => {
    const newer = newerFullByOffset.get(entry.o);
    newerFullByOffset.set(entry.o, entry);
    return newer ? stripUnchangedValues(newer, entry) : entry;
  });

  if (oldFormat.length === 0 && isDeepStrictEqual(hiscoreEntries, stored)) return { status: 'skipped' };

  const checkLayouts = new Map(needed);
  for (const [id, layout] of layouts) checkLayouts.set(id, layout);
  const failure = check(hiscoreEntries, checkLayouts, mapped);
  if (failure) return failure;

  return { status: 'converted', hiscoreEntries, layouts: [...needed.values()], oldFormatEntries: oldFormat.length };
}

/** Decodes `hiscoreEntries` and compares every entry with what was mapped; `undefined` when all are equal. */
function check(
  hiscoreEntries: StoredHiscoreEntry[],
  layouts: ReadonlyMap<number, HiscoreLayout>,
  mapped: readonly Mapped[],
): PlayerMigration | undefined {
  let decoded: HiscoreEntry[];
  try {
    decoded = decodeHiscoreEntries(hiscoreEntries, layouts);
  } catch (error) {
    return { status: 'failed', reason: `Check: decoding the new entries failed: ${(error as Error).message}` };
  }
  for (let index = 0; index < mapped.length; index++) {
    const expected = mapped[index].entry;
    if (isDeepStrictEqual(decoded[index], expected)) continue;
    return {
      status: 'failed',
      reason: `Check: the new entry decodes differently: ${firstDifference(decoded[index], expected)}`,
      entry: { index, date: expected.date, scrapingOffset: expected.scrapingOffset },
    };
  }
  return undefined;
}

function firstDifference(actual: HiscoreEntry | undefined, expected: HiscoreEntry): string {
  if (!actual) return 'missing';
  for (const key of ['date', 'scrapingOffset'] as const) {
    if (!isDeepStrictEqual(actual[key], expected[key]))
      return `${key} ${json(actual[key])}, expected ${json(expected[key])}`;
  }
  for (const group of ['skills', 'activities'] as const) {
    const a: Record<string, unknown> = actual[group];
    const e: Record<string, unknown> = expected[group];
    for (const name of new Set([...Object.keys(e), ...Object.keys(a)])) {
      if (!isDeepStrictEqual(a[name], e[name])) return `${group}.${name} ${json(a[name])}, expected ${json(e[name])}`;
    }
  }
  return 'unknown difference';
}

function json(value: unknown): string {
  return value === undefined ? 'missing' : JSON.stringify(value);
}

function assertKnownShape(entry: AnyHiscoreEntry, index: number): void {
  const ok = isStoredEntry(entry)
    ? entry.d instanceof Date && Array.isArray(entry.s) && Array.isArray(entry.a)
    : entry.date instanceof Date && Array.isArray(entry.skills) && Array.isArray(entry.activities);
  if (!ok) throw new Error(`Entry ${index} has an unknown shape (keys: ${Object.keys(entry).join(', ')})`);
}
