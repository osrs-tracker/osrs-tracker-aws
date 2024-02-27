import { describe, expect, it } from '@jest/globals';
import { calculateXPForSkillLevel, calculateXPToNextLevel } from './levels';

describe('calculateTotalXP', () => {
  it('should return 0 for level 1', () => {
    expect(calculateXPForSkillLevel(1)).toBe(0);
  });

  it('should return 83 for level 2', () => {
    expect(calculateXPForSkillLevel(2)).toBe(83);
  });

  it('should return 174 for level 3', () => {
    expect(calculateXPForSkillLevel(3)).toBe(174);
  });

  // skip 30 levels

  it('should return 20.224 for level 34', () => {
    expect(calculateXPForSkillLevel(34)).toBe(20224);
  });

  it('should return 22.406 for level 35', () => {
    expect(calculateXPForSkillLevel(35)).toBe(22406);
  });

  it('should return 24.815 for level 36', () => {
    expect(calculateXPForSkillLevel(36)).toBe(24815);
  });

  // skip 30 levels

  it('should return 547.953 for level 67', () => {
    expect(calculateXPForSkillLevel(67)).toBe(547953);
  });

  it('should return 605.032 for level 68', () => {
    expect(calculateXPForSkillLevel(68)).toBe(605032);
  });

  it('should return 668.051 for level 69', () => {
    expect(calculateXPForSkillLevel(69)).toBe(668051);
  });

  // skip 27 levels

  it('should return 10.692.629 for level 97', () => {
    expect(calculateXPForSkillLevel(97)).toBe(10692629);
  });

  it('should return 11.805.606 for level 98', () => {
    expect(calculateXPForSkillLevel(98)).toBe(11805606);
  });

  it('should return 13.034.431 for level 99', () => {
    expect(calculateXPForSkillLevel(99)).toBe(13034431);
  });
});

describe('calculateXPToNextLevel', () => {
  it('should return correct XP for next level when current XP is 0', () => {
    expect(calculateXPToNextLevel(0, 1)).toBe(calculateXPForSkillLevel(2));
    expect(calculateXPToNextLevel(calculateXPForSkillLevel(2), 2)).toBe(
      calculateXPForSkillLevel(3) - calculateXPForSkillLevel(2),
    );
  });

  it('should return correct XP for next level when current XP is halfway to next level', () => {
    const halfwayXP = calculateXPForSkillLevel(2) / 2;
    expect(calculateXPToNextLevel(halfwayXP, 1)).toBe(calculateXPForSkillLevel(2) - halfwayXP);
  });
});
