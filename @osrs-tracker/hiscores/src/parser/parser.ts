import { HiscoreEntry } from '@osrs-tracker/models';
import { SkillEnum } from '../models/hiscore.enum.js';

/**
 * Returns the difference between two hiscores as a new Hiscore object.
 *
 * @param recent The most recent hiscore.
 * @param old The older hiscore.
 *
 * @returns The difference between the two hiscores.
 */
export function hiscoreDiff(recent: HiscoreEntry, old: HiscoreEntry): HiscoreEntry {
  const diffEntries = Object.entries(recent).map(([hiscoreKey, recentValue]) => {
    switch (hiscoreKey) {
      case 'skills':
        return [
          'skills',
          (recentValue as HiscoreEntry['skills']).map((skill) => {
            const oldSkill = old.skills.find((s) => s.name === skill.name);
            return {
              ...skill,
              rank: skill.rank - (oldSkill?.rank ?? 0),
              level: skill.level - (oldSkill?.level ?? 0),
              xp: diff(skill.xp, oldSkill?.xp ?? 0),
            };
          }),
        ];
      case 'activities':
        return [
          'activities',
          (recentValue as HiscoreEntry['activities']).map((activity) => {
            const oldActivity = old.activities.find((a) => a.name === activity.name);
            return {
              ...activity,
              rank: activity.rank - (oldActivity?.rank ?? 0),
              score: diff(activity.score, oldActivity?.score ?? 0),
            };
          }),
        ];
      default:
        return [hiscoreKey, old[hiscoreKey as keyof HiscoreEntry]];
    }
  });

  return Object.fromEntries(diffEntries);
}

/**
 * Returns the difference in overall xp between two hiscore entries.
 *
 * @param today The most recent hiscore entry.
 * @param recent The older hiscore entry.
 *
 * @returns The difference in overall xp between the two hiscore entries.
 */
export function getOverallXpDiff(today: HiscoreEntry, recent: HiscoreEntry): number {
  const todayOverall = today.skills.find((s) => s.name === SkillEnum.Overall);
  const recentOverall = recent.skills.find((s) => s.name === SkillEnum.Overall);

  return diff(todayOverall?.xp ?? 0, recentOverall?.xp ?? 0);
}

/** For some reason skills and activities can have 0 or -1 exp in the hiscore API. */
function diff(a: number, b: number): number {
  return Math.max(a, 0) - Math.max(b, 0);
}
