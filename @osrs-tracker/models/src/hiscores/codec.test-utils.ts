// Test helpers for the codec and layout specs. Not exported from the package.
import { readFileSync } from 'node:fs';
import { HiscoreEntry, HiscoreLayoutNames, StoredHiscoreEntry, StoredHiscoreValue } from '../models/hiscores.js';

export interface CodecFixture {
  skills: HiscoreEntry['skills'];
  activities: HiscoreEntry['activities'];
  layout: HiscoreLayoutNames;
}

/** The 4 real public hiscores in `fixtures/hiscores.json`, parsed fresh on every call. */
export function codecFixtures(): Record<string, CodecFixture> {
  return JSON.parse(readFileSync(new URL('./fixtures/hiscores.json', import.meta.url), 'utf8'));
}

/**
 * What the write expression does, in plain code, so tests can build bare-value histories: prepend the new full entry;
 * the newest existing entry with the same `o`, only if it also has the same `l`, gets each full value except `s[0]`
 * whose xp/score equals the new entry's value at that position replaced by its bare rank (`0` if unranked).
 */
export function writeStoredEntry(history: StoredHiscoreEntry[], entry: StoredHiscoreEntry): StoredHiscoreEntry[] {
  const index = history.findIndex((older) => older.o === entry.o);
  const result = [entry, ...history];
  if (index === -1 || history[index].l !== entry.l) return result;

  const older = history[index];
  result[index + 1] = {
    ...older,
    s: older.s.map((value, i) => (i === 0 ? value : strip(value, entry.s[i]))),
    a: older.a.map((value, i) => strip(value, entry.a[i])),
  };
  return result;
}

function strip(older: StoredHiscoreValue, newer: StoredHiscoreValue): StoredHiscoreValue {
  if (!Array.isArray(older) || !Array.isArray(newer)) return older;
  return older[older.length - 1] === newer[newer.length - 1] ? (older[0] ?? 0) : older;
}

/** A copy of `entry` with every rank moved by `rankShift` (ranked values only) and the given values replaced. */
export function nextEntry(
  entry: HiscoreEntry,
  date: Date,
  changes: { rankShift?: number; skills?: HiscoreEntry['skills']; activities?: HiscoreEntry['activities'] } = {},
): HiscoreEntry {
  const shift = changes.rankShift ?? 0;
  const skills: HiscoreEntry['skills'] = {};
  for (const [name, value] of Object.entries(entry.skills)) {
    skills[name] = value && { ...value, rank: value.rank && value.rank + shift };
  }
  const activities: HiscoreEntry['activities'] = {};
  for (const [name, value] of Object.entries(entry.activities)) {
    activities[name] = value && { ...value, rank: value.rank && value.rank + shift };
  }
  return {
    date,
    scrapingOffset: entry.scrapingOffset,
    skills: { ...skills, ...changes.skills },
    activities: { ...activities, ...changes.activities },
  };
}

/** `n` days after 2026-09-01 at `offset` hours past UTC midnight. */
export function day(n: number, offset = 0): Date {
  return new Date(Date.UTC(2026, 8, 1 + n, offset));
}
