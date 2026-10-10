import { SkillEnum } from '../models/hiscore.enum.js';
import { HiscoreEntry, HiscoreSkill } from '../models/hiscores.js';

/** The level Jagex shows for a skill without xp. */
export const UNTRAINED_LEVEL = 1;

/** A skill's level, {@link UNTRAINED_LEVEL} when the skill has no xp (`null`) or isn't in the entry. */
export function skillLevel(skill: HiscoreSkill | null | undefined): number {
  return skill?.level ?? UNTRAINED_LEVEL;
}

/** An entry's Overall, which is never `null` in stored or mapped entries. Throws when it is missing anyway. */
export function overallOf(entry: Pick<HiscoreEntry, 'skills'>): HiscoreSkill {
  const overall = entry.skills[SkillEnum.Overall];
  if (!overall) throw new Error('Hiscore entry has no Overall');
  return overall;
}
