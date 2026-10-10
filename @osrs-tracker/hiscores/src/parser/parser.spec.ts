import { describe, expect, it } from '@jest/globals';
import { ActivityEnum, HiscoreEntry, SkillEnum } from '@osrs-tracker/models';
import { getOverallXpDiff, hiscoreDiff } from './parser';

function entry(day: number, skills: HiscoreEntry['skills'], activities: HiscoreEntry['activities'] = {}): HiscoreEntry {
  return { date: new Date(2024, 0, day), scrapingOffset: day, skills, activities };
}

describe('hiscoreDiff', () => {
  it('diffs skills and activities and keeps the date and offset of the old entry', () => {
    const oldEntry = entry(
      1,
      {
        [SkillEnum.Overall]: { rank: 100, level: 50, xp: 1000 },
        [SkillEnum.Attack]: { rank: 250, level: 30, xp: 500 },
      },
      {
        [ActivityEnum.BountyHunter]: { rank: 20, score: 200 },
        [ActivityEnum.BountyHunterRogue]: { rank: 15, score: 80 },
      },
    );
    const recentEntry = entry(
      2,
      {
        [SkillEnum.Overall]: { rank: 110, level: 52, xp: 1500 },
        [SkillEnum.Attack]: { rank: 260, level: 31, xp: 700 },
      },
      {
        [ActivityEnum.BountyHunter]: { rank: 30, score: 280 },
        [ActivityEnum.BountyHunterRogue]: { rank: 18, score: 120 },
      },
    );

    expect(hiscoreDiff(recentEntry, oldEntry)).toEqual({
      date: oldEntry.date,
      scrapingOffset: oldEntry.scrapingOffset,
      skills: {
        [SkillEnum.Overall]: { rank: 10, level: 2, xp: 500 },
        [SkillEnum.Attack]: { rank: 10, level: 1, xp: 200 },
      },
      activities: {
        [ActivityEnum.BountyHunter]: { rank: 10, score: 80 },
        [ActivityEnum.BountyHunterRogue]: { rank: 3, score: 40 },
      },
    });
  });

  it('covers names on only one side, counting the missing side as 0 (level 1)', () => {
    const oldEntry = entry(1, { Overall: { rank: 200, level: 10, xp: 10 }, Agility: { rank: 5, level: 3, xp: 200 } });
    const recentEntry = entry(
      2,
      { Overall: { rank: 205, level: 12, xp: 1500 } },
      { [ActivityEnum.BountyHunter]: { rank: 7, score: 80 } },
    );

    expect(hiscoreDiff(recentEntry, oldEntry)).toEqual({
      date: oldEntry.date,
      scrapingOffset: 1,
      skills: { Overall: { rank: 5, level: 2, xp: 1490 }, Agility: { rank: -5, level: -2, xp: -200 } },
      activities: { [ActivityEnum.BountyHunter]: { rank: 7, score: 80 } },
    });
  });

  it('counts null on either side as 0 (level 1), so no diff value is null', () => {
    const oldEntry = entry(
      1,
      { Overall: { rank: null, level: 30, xp: 0 }, Fishing: null, Cooking: { rank: 9, level: 5, xp: 400 } },
      { 'Grid Points': null, 'Zulrah': { rank: null, score: 4 } },
    );
    const recentEntry = entry(
      2,
      { Overall: { rank: 50, level: 31, xp: 100 }, Fishing: { rank: null, level: 2, xp: 100 }, Cooking: null },
      { 'Grid Points': { rank: 3, score: 12 }, 'Zulrah': null },
    );

    expect(hiscoreDiff(recentEntry, oldEntry)).toEqual({
      date: oldEntry.date,
      scrapingOffset: 1,
      skills: {
        Overall: { rank: 50, level: 1, xp: 100 },
        Fishing: { rank: 0, level: 1, xp: 100 },
        Cooking: { rank: -9, level: -4, xp: -400 },
      },
      activities: { 'Grid Points': { rank: 3, score: 12 }, 'Zulrah': { rank: 0, score: -4 } },
    });
  });

  it('counts a null skill as level 1 when it becomes ranked', () => {
    const diff = hiscoreDiff(entry(2, { Mining: { rank: 300, level: 5, xp: 400 } }), entry(1, { Mining: null }));
    expect(diff.skills['Mining']).toEqual({ rank: 300, level: 4, xp: 400 });
  });

  it('counts a missing skill as level 1 when it appears ranked', () => {
    const diff = hiscoreDiff(entry(2, { Sailing: { rank: 300, level: 5, xp: 400 } }), entry(1, {}));
    expect(diff.skills['Sailing']).toEqual({ rank: 300, level: 4, xp: 400 });
  });

  it('diffs names in neither enum', () => {
    const oldEntry = entry(1, { Necromancy: { rank: 9, level: 2, xp: 100 } }, { 'Moon Raids': { rank: 4, score: 7 } });
    const recentEntry = entry(
      2,
      { Necromancy: { rank: 8, level: 3, xp: 200 } },
      { 'Moon Raids': { rank: 2, score: 10 } },
    );

    const diff = hiscoreDiff(recentEntry, oldEntry);
    expect(diff.skills['Necromancy']).toEqual({ rank: -1, level: 1, xp: 100 });
    expect(diff.activities['Moon Raids']).toEqual({ rank: -2, score: 3 });
  });

  it('treats negative xp and scores as 0', () => {
    const diff = hiscoreDiff(
      entry(2, { Overall: { rank: 1, level: 1, xp: -5 } }, { LMS: { rank: 1, score: -1 } }),
      entry(1, {}, {}),
    );
    expect(diff.skills['Overall']?.xp).toBe(0);
    expect(diff.activities['LMS']?.score).toBe(0);
  });
});

describe('getOverallXpDiff', () => {
  it('returns the overall xp delta', () => {
    const older = entry(1, { Overall: { rank: 10, level: 30, xp: 1000 } });
    const newer = entry(2, { Overall: { rank: 11, level: 31, xp: 3200 } });
    expect(getOverallXpDiff(newer, older)).toBe(2200);
  });

  it('counts a missing, null or negative Overall as 0', () => {
    expect(getOverallXpDiff(entry(2, { Overall: { rank: 1, level: 1, xp: -5 } }), entry(1, {}))).toBe(0);
    expect(getOverallXpDiff(entry(2, { Overall: { rank: 1, level: 1, xp: 50 } }), entry(1, { Overall: null }))).toBe(
      50,
    );
    expect(getOverallXpDiff(entry(2, {}), entry(1, { Overall: { rank: 1, level: 1, xp: 50 } }))).toBe(-50);
  });
});
