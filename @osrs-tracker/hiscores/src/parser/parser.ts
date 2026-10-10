import {
  HiscoreDiff,
  HiscoreDiffActivity,
  HiscoreDiffSkill,
  HiscoreEntry,
  SkillEnum,
  skillLevel,
} from '@osrs-tracker/models';

/**
 * Returns the difference between two hiscore entries, in the same keyed shape.
 *
 * Covers the union of both entries' names (a name can appear or disappear between entries). `null` (no value) or a
 * missing name counts as 0, except a skill's level, which counts as 1 (`skillLevel`, the level Jagex shows without xp).
 * Every value in the result is an object of numbers, never `null` ({@link HiscoreDiff}). Skills diff `rank`, `level` and `xp`, activities `rank` and
 * `score`. `date` and `scrapingOffset` come from the older entry.
 *
 * @param recent The most recent hiscore entry.
 * @param old The older hiscore entry.
 */
export function hiscoreDiff(recent: HiscoreEntry, old: HiscoreEntry): HiscoreDiff {
  const skills: Record<string, HiscoreDiffSkill> = {};
  for (const name of unionKeys(recent.skills, old.skills)) {
    const r = recent.skills[name];
    const o = old.skills[name];
    skills[name] = {
      rank: (r?.rank ?? 0) - (o?.rank ?? 0),
      level: skillLevel(r) - skillLevel(o),
      xp: diff(r?.xp, o?.xp),
    };
  }

  const activities: Record<string, HiscoreDiffActivity> = {};
  for (const name of unionKeys(recent.activities, old.activities)) {
    const r = recent.activities[name];
    const o = old.activities[name];
    activities[name] = {
      rank: (r?.rank ?? 0) - (o?.rank ?? 0),
      score: diff(r?.score, o?.score),
    };
  }

  return { date: old.date, scrapingOffset: old.scrapingOffset, skills, activities };
}

/**
 * Returns the difference in overall xp between two hiscore entries; a `null` or missing Overall counts as 0.
 *
 * @param today The most recent hiscore entry.
 * @param recent The older hiscore entry.
 */
export function getOverallXpDiff(today: HiscoreEntry, recent: HiscoreEntry): number {
  return diff(today.skills[SkillEnum.Overall]?.xp, recent.skills[SkillEnum.Overall]?.xp);
}

/** The names in either object, the recent entry's first. */
function unionKeys(a: object, b: object): Set<string> {
  return new Set([...Object.keys(a), ...Object.keys(b)]);
}

/** Missing, `null` and negative values count as 0. */
function diff(a: number | null | undefined, b: number | null | undefined): number {
  return Math.max(a ?? 0, 0) - Math.max(b ?? 0, 0);
}
