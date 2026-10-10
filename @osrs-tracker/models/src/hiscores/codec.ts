import {
  HiscoreActivity,
  HiscoreEntry,
  HiscoreLayout,
  HiscoreSkill,
  StoredHiscoreEntry,
  StoredHiscoreValue,
} from '../models/hiscores.js';
import { levelForXp } from '../xp/levels.js';

/** Thrown by {@link decodeHiscoreEntries} for a layout id missing from `layouts`: load it and decode again. */
export class UnknownHiscoreLayoutError extends Error {
  readonly layoutId: number;

  constructor(layoutId: number) {
    super(`Unknown hiscore layout ${layoutId}`);
    this.name = 'UnknownHiscoreLayoutError';
    this.layoutId = layoutId;
  }
}

/**
 * Encodes a domain entry in full (bare values only come from the write expression), by position in `layout`. Overall
 * (index 0 of the skills) keeps its level; other levels are derived from xp on decode. A missing key or `null` is
 * stored as `null`. Throws when the entry has a name the layout doesn't, or no Overall: the layout is the wrong one.
 */
export function encodeHiscoreEntry(entry: HiscoreEntry, layout: HiscoreLayout): StoredHiscoreEntry {
  assertNamesInLayout(entry.skills, layout.skills, 'skill', layout._id);
  assertNamesInLayout(entry.activities, layout.activities, 'activity', layout._id);

  const s = layout.skills.map((name, i): StoredHiscoreValue => {
    const skill = entry.skills[name];
    if (i === 0) {
      if (!skill) throw new Error(`Hiscore entry has no value for ${name}, the first skill of layout ${layout._id}`);
      return [skill.rank, skill.level, skill.xp];
    }
    return skill ? [skill.rank, skill.xp] : null;
  });
  const a = layout.activities.map((name): StoredHiscoreValue => {
    const activity = entry.activities[name];
    return activity ? [activity.rank, activity.score] : null;
  });

  return { d: entry.date, o: entry.scrapingOffset, l: layout._id, s, a };
}

/**
 * Decodes one player's stored entries, **newest first** (as stored). Per scraping offset, a bare value takes the xp or
 * score of the last full value of the same name in a newer entry, across layouts. Levels other than Overall's come from
 * {@link levelForXp}; a rank of `0` or `null` becomes `null`. Keys follow the layout's order.
 *
 * Throws {@link UnknownHiscoreLayoutError} for a layout missing from `layouts`, and an `Error` for a bare value with no
 * newer full value or an entry whose length doesn't match its layout.
 */
export function decodeHiscoreEntries(
  entries: readonly StoredHiscoreEntry[],
  layouts: ReadonlyMap<number, HiscoreLayout>,
): HiscoreEntry[] {
  const carriedByOffset = new Map<number, Carried>();

  return entries.map((entry) => {
    const layout = layouts.get(entry.l);
    if (!layout) throw new UnknownHiscoreLayoutError(entry.l);
    if (entry.s.length !== layout.skills.length || entry.a.length !== layout.activities.length) {
      throw new Error(
        `Hiscore entry of ${describe(entry)} has ${entry.s.length} skills and ${entry.a.length} activities, ` +
          `layout ${layout._id} has ${layout.skills.length} and ${layout.activities.length}`,
      );
    }

    let carried = carriedByOffset.get(entry.o);
    if (!carried) {
      carried = { skills: new Map(), activities: new Map() };
      carriedByOffset.set(entry.o, carried);
    }

    const skills: HiscoreEntry['skills'] = {};
    for (let i = 0; i < layout.skills.length; i++) {
      const name = layout.skills[i];
      skills[name] = decodeSkill(entry.s[i], name, carried.skills, entry);
    }
    const activities: HiscoreEntry['activities'] = {};
    for (let i = 0; i < layout.activities.length; i++) {
      const name = layout.activities[i];
      activities[name] = decodeActivity(entry.a[i], name, carried.activities, entry);
    }

    return { date: entry.d, scrapingOffset: entry.o, skills, activities };
  });
}

/** The distinct layout ids of `entries`, in order of first use: the layouts to load before decoding them. */
export function hiscoreLayoutIds(entries: readonly StoredHiscoreEntry[]): number[] {
  return [...new Set(entries.map((entry) => entry.l))];
}

/** The last full value per name, for one scraping offset. */
interface Carried {
  skills: Map<string, { level: number; xp: number }>;
  activities: Map<string, number>;
}

function decodeSkill(
  stored: StoredHiscoreValue,
  name: string,
  carried: Carried['skills'],
  entry: StoredHiscoreEntry,
): HiscoreSkill | null {
  if (stored === null) {
    carried.delete(name);
    return null;
  }
  if (typeof stored === 'number') {
    const value = carried.get(name);
    if (!value) throw bareWithoutValue('skill', name, entry);
    return { rank: stored || null, level: value.level, xp: value.xp };
  }
  const xp = stored.length === 3 ? stored[2] : stored[1];
  const level = stored.length === 3 ? stored[1] : levelForXp(xp);
  carried.set(name, { level, xp });
  return { rank: stored[0] || null, level, xp };
}

function decodeActivity(
  stored: StoredHiscoreValue,
  name: string,
  carried: Carried['activities'],
  entry: StoredHiscoreEntry,
): HiscoreActivity | null {
  if (stored === null) {
    carried.delete(name);
    return null;
  }
  if (typeof stored === 'number') {
    const score = carried.get(name);
    if (score === undefined) throw bareWithoutValue('activity', name, entry);
    return { rank: stored || null, score };
  }
  const score = stored.length === 3 ? stored[2] : stored[1];
  carried.set(name, score);
  return { rank: stored[0] || null, score };
}

function assertNamesInLayout(values: object, names: readonly string[], kind: string, id: number): void {
  const keys = Object.keys(values);
  if (keys.length === 0) return;
  const known = new Set(names);
  const unknown = keys.filter((key) => !known.has(key));
  if (unknown.length) throw new Error(`Hiscore entry has ${kind} names not in layout ${id}: ${unknown.join(', ')}`);
}

function bareWithoutValue(kind: string, name: string, entry: StoredHiscoreEntry): Error {
  return new Error(`Bare ${kind} value for ${name} in the entry of ${describe(entry)} has no newer full value`);
}

function describe(entry: StoredHiscoreEntry): string {
  const date = entry.d instanceof Date ? entry.d.toISOString() : String(entry.d);
  return `${date} (offset ${entry.o})`;
}
