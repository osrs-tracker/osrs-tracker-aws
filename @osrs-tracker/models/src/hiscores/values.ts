import { SkillEnum } from '../models/hiscore.enum.js';
import { HiscoreEntry, HiscoreSkill } from '../models/hiscores.js';
import { MAX_SKILL_LEVEL, percentageToNextLevel } from '../xp/levels.js';

/** The level Jagex shows for a skill without xp. */
export const UNTRAINED_LEVEL = 1;

/** A skill's level, {@link UNTRAINED_LEVEL} when the skill has no xp (`null`) or isn't in the entry. */
export function skillLevel(skill: HiscoreSkill | null | undefined): number {
  return skill?.level ?? UNTRAINED_LEVEL;
}

/** A skill's level, xp and progress into its level, for showing it. */
export interface SkillProgress {
  level: number;
  xp: number;
  /** How far the xp is into the level, 0–100; `null` at the highest level, where there's no next level. */
  percentToNextLevel: number | null;
}

/**
 * A skill's level, xp and progress to the next level. A skill without xp (`null`) or not in the entry is untrained:
 * level {@link UNTRAINED_LEVEL}, 0 xp, 0% to the next level.
 */
export function skillProgress(skill: HiscoreSkill | null | undefined): SkillProgress {
  const level = skillLevel(skill);
  const xp = skill?.xp ?? 0;
  return { level, xp, percentToNextLevel: level < MAX_SKILL_LEVEL ? percentageToNextLevel(xp, level) : null };
}

/** An entry's Overall, which is never `null` in stored or mapped entries. Throws when it is missing anyway. */
export function overallOf(entry: Pick<HiscoreEntry, 'skills'>): HiscoreSkill {
  const overall = entry.skills[SkillEnum.Overall];
  if (!overall) throw new Error('Hiscore entry has no Overall');
  return overall;
}
