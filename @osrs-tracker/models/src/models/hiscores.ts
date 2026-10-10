import { ActivityEnum, SkillEnum } from './hiscore.enum.js';

/**
 * A skill's name. Any string, so a skill Jagex adds is stored and served before {@link SkillEnum} knows it; editors
 * still suggest the enum's values.
 */
export type SkillName = SkillEnum | (string & {});
/** An activity's name, any string like {@link SkillName}. */
export type ActivityName = ActivityEnum | (string & {});

/** `rank: null`: unranked (below Jagex's ranking cut-off) with a known value. */
export interface HiscoreSkill {
  rank: number | null;
  level: number;
  xp: number;
}

/** `rank: null`: unranked (below Jagex's ranking cut-off) with a known score. */
export interface HiscoreActivity {
  rank: number | null;
  score: number;
}

/**
 * One hiscore scrape, keyed by name. A value of `null` means no value (no xp or score); a missing key means the name
 * wasn't on the hiscores when this entry was scraped. Overall is never `null`.
 */
export interface HiscoreEntry {
  date: Date;
  scrapingOffset: number;
  skills: Partial<Record<SkillName, HiscoreSkill | null>>;
  activities: Partial<Record<ActivityName, HiscoreActivity | null>>;
}

/** The skill and activity names of a hiscore response, in Jagex's order. */
export interface HiscoreLayoutNames {
  skills: string[];
  activities: string[];
}

/** One document in `hiscoreLayouts`: a name list Jagex has used. `_id` is `layoutId(skills, activities)`. */
export interface HiscoreLayout extends HiscoreLayoutNames {
  _id: number;
  /** When the first entry with this layout was written. */
  since: Date;
}

/**
 * One stored value, by position in the entry's layout:
 * - `[rank, xp]` / `[rank, score]`: ranked, full value; `[null, xp]` / `[null, score]`: unranked, full value
 * - `[rank or null, level, xp]`: Overall (index 0 of `s`), always full
 * - bare `rank`: ranked, the same value as this name in the next newer entry with the same `o`
 * - bare `0`: unranked, the same value as in the next newer entry (a real rank is never 0)
 * - `null`: no value
 */
export type StoredHiscoreValue =
  | number
  | null
  | [rank: number | null, value: number]
  | [rank: number | null, level: number, xp: number];

/** A hiscore entry as stored in `players.hiscoreEntries`. The newest entry per offset is always stored in full. */
export interface StoredHiscoreEntry {
  /** date */
  d: Date;
  /** scrapingOffset */
  o: number;
  /** layout id, `_id` in `hiscoreLayouts` */
  l: number;
  /** skills, by position in the layout */
  s: StoredHiscoreValue[];
  /** activities, by position in the layout */
  a: StoredHiscoreValue[];
}
