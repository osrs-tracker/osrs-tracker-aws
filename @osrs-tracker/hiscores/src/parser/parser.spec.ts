import { describe, expect, it } from '@jest/globals';
import { ActivityEnum, SkillEnum } from '../models/hiscore.enum';
import { getOverallXpDiff, hiscoreDiff } from './parser';

describe('hiscoreDiff', () => {
  it('should calculate skill and activity deltas while preserving metadata values from the old entry', () => {
    const oldEntry = {
      date: new Date(2024, 0, 1),
      scrapingOffset: 0,
      skills: [
        { id: 0, name: SkillEnum.Overall, rank: 100, level: 50, xp: 1000 },
        { id: 1, name: SkillEnum.Attack, rank: 250, level: 30, xp: 500 },
      ],
      activities: [
        { id: 0, name: ActivityEnum.BountyHunter, rank: 20, score: 200 },
        { id: 1, name: ActivityEnum.BountyHunterRogue, rank: 15, score: 80 },
      ],
    };

    const recentEntry = {
      date: new Date(2024, 0, 2),
      scrapingOffset: 0,
      skills: [
        { id: 0, name: SkillEnum.Overall, rank: 110, level: 52, xp: 1500 },
        { id: 1, name: SkillEnum.Attack, rank: 260, level: 31, xp: 700 },
      ],
      activities: [
        { id: 0, name: ActivityEnum.BountyHunter, rank: 30, score: 280 },
        { id: 1, name: ActivityEnum.BountyHunterRogue, rank: 18, score: 120 },
      ],
    };

    expect(hiscoreDiff(recentEntry, oldEntry)).toEqual({
      date: oldEntry.date,
      scrapingOffset: oldEntry.scrapingOffset,
      skills: [
        { id: 0, name: SkillEnum.Overall, rank: 10, level: 2, xp: 500 },
        { id: 1, name: SkillEnum.Attack, rank: 10, level: 1, xp: 200 },
      ],
      activities: [
        { id: 0, name: ActivityEnum.BountyHunter, rank: 10, score: 80 },
        { id: 1, name: ActivityEnum.BountyHunterRogue, rank: 3, score: 40 },
      ],
    });
  });

  it('should treat missing old entries as zero when calculating deltas', () => {
    const oldEntry = {
      date: new Date(2024, 0, 1),
      scrapingOffset: 0,
      skills: [{ id: 0, name: SkillEnum.Overall, rank: 200, level: 10, xp: 10 }],
      activities: [],
    };

    const recentEntry = {
      date: new Date(2024, 0, 2),
      scrapingOffset: 0,
      skills: [{ id: 0, name: SkillEnum.Overall, rank: 205, level: 12, xp: 1500 }],
      activities: [{ id: 0, name: ActivityEnum.BountyHunter, rank: 7, score: 80 }],
    };

    const diff = hiscoreDiff(recentEntry, oldEntry);

    expect(diff.skills).toEqual([{ id: 0, name: SkillEnum.Overall, rank: 5, level: 2, xp: 1490 }]);
    expect(diff.activities).toEqual([{ id: 0, name: ActivityEnum.BountyHunter, rank: 7, score: 80 }]);
  });
});

describe('getOverallXpDiff', () => {
  it('should return the overall XP delta between two hiscore entries', () => {
    const older = {
      date: new Date(2024, 0, 1),
      scrapingOffset: 0,
      skills: [{ id: 0, name: SkillEnum.Overall, rank: 10, level: 30, xp: 1000 }],
      activities: [],
    };

    const newer = {
      date: new Date(2024, 0, 2),
      scrapingOffset: 0,
      skills: [{ id: 0, name: SkillEnum.Overall, rank: 11, level: 31, xp: 3200 }],
      activities: [],
    };

    expect(getOverallXpDiff(newer, older)).toBe(2200);
  });

  it('should ignore negative XP values and use zero when a skill is missing', () => {
    const older = {
      date: new Date(2024, 0, 1),
      scrapingOffset: 0,
      skills: [],
      activities: [],
    };

    const newer = {
      date: new Date(2024, 0, 2),
      scrapingOffset: 0,
      skills: [{ id: 0, name: SkillEnum.Overall, rank: 1, level: 1, xp: -5 }],
      activities: [],
    };

    expect(getOverallXpDiff(newer, older)).toBe(0);
  });
});
