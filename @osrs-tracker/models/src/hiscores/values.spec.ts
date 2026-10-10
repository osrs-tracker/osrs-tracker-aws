import { describe, expect, it } from 'vitest';
import { HiscoreEntry } from '../models/hiscores.js';
import { overallOf, skillLevel, skillProgress, UNTRAINED_LEVEL } from './values.js';

const entry = (skills: HiscoreEntry['skills']): HiscoreEntry => ({
  date: new Date(0),
  scrapingOffset: 0,
  skills,
  activities: {},
});

describe('skillLevel', () => {
  it('is the level of a skill with xp', () => {
    expect(skillLevel({ rank: null, level: 12, xp: 1_500 })).toBe(12);
  });

  it('is 1 for a skill without xp or not in the entry', () => {
    expect(skillLevel(null)).toBe(UNTRAINED_LEVEL);
    expect(skillLevel(undefined)).toBe(1);
    expect(skillLevel(entry({}).skills['Some New Skill'])).toBe(1);
  });
});

describe('overallOf', () => {
  it("returns the entry's Overall", () => {
    const overall = { rank: 5, level: 2_376, xp: 4_600_000_000 };
    expect(overallOf(entry({ Overall: overall }))).toBe(overall);
  });

  it('throws when Overall is missing or null', () => {
    expect(() => overallOf(entry({}))).toThrow('no Overall');
    expect(() => overallOf(entry({ Overall: null }))).toThrow('no Overall');
  });
});

describe('skillProgress', () => {
  it('gives the level, xp and progress into the level', () => {
    // level 2 starts at 83 xp, level 3 at 174: 45 of 91 xp in
    const progress = skillProgress({ rank: 5, level: 2, xp: 128 });
    expect(progress).toMatchObject({ level: 2, xp: 128 });
    expect(progress.percentToNextLevel).toBeCloseTo((45 / 91) * 100);
  });

  it('treats a skill without xp or not in the entry as untrained', () => {
    const untrained = { level: 1, xp: 0, percentToNextLevel: 0 };
    expect(skillProgress(null)).toEqual(untrained);
    expect(skillProgress(undefined)).toEqual(untrained);
  });

  it('has no next level at 99', () => {
    expect(skillProgress({ rank: 1, level: 99, xp: 200_000_000 }).percentToNextLevel).toBeNull();
  });
});
