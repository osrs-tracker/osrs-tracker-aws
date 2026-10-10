import { describe, expect, it } from 'vitest';
import { HiscoreEntry } from '../models/hiscores.js';
import { overallOf, skillLevel, UNTRAINED_LEVEL } from './values.js';

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
