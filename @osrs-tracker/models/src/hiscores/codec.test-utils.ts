// Test helpers for the codec and layout specs. Not exported from the package.
import { readFileSync } from 'node:fs';
import { HiscoreEntry, HiscoreLayoutNames, StoredHiscoreEntry } from '../models/hiscores.js';
import { stripUnchangedValues } from './write-expression.js';

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
 * What the write expression does, in plain code, so tests can build bare-value histories: prepend the new full entry
 * and strip the newest existing entry with the same `o` ({@link stripUnchangedValues}).
 */
export function writeStoredEntry(history: StoredHiscoreEntry[], entry: StoredHiscoreEntry): StoredHiscoreEntry[] {
  const index = history.findIndex((older) => older.o === entry.o);
  const result = [entry, ...history];
  if (index !== -1) result[index + 1] = stripUnchangedValues(entry, history[index]);
  return result;
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
