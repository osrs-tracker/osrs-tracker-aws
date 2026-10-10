/** The highest level a skill shows on the hiscores; more xp doesn't raise it. */
export const MAX_SKILL_LEVEL = 99;
/** The highest virtual level (200M xp is level 126), so xp-to-next-level works past 99. */
const MAX_VIRTUAL_LEVEL = 126;

/** Total xp needed per level: `XP_TABLE[level]`, from level 1 (0 xp) to 126. Index 0 is unused (0). */
export const XP_TABLE: readonly number[] = (() => {
  const table = [0, 0];
  let points = 0;
  for (let level = 1; level < MAX_VIRTUAL_LEVEL; level++) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table.push(Math.floor(points / 4));
  }
  return table;
})();

export function calculateXPForSkillLevel(level: number): number {
  if (level <= 1) return 0;
  if (Number.isInteger(level) && level <= MAX_VIRTUAL_LEVEL) return XP_TABLE[level];

  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.floor(i + 300 * Math.pow(2, i / 7));
  }
  return Math.floor(total / 4);
}

export function calculateXPToNextLevel(currentXP: number, currentLevel: number): number {
  const totalXPNextLevel = calculateXPForSkillLevel(currentLevel + 1);
  return totalXPNextLevel - currentXP;
}

/** How far `xp` is into `level`, 0–100 (capped at 100). */
export function percentageToNextLevel(xp: number, level: number): number {
  const xpForCurrentLevel = calculateXPForSkillLevel(level);
  const xpForNextLevel = calculateXPForSkillLevel(level + 1);
  return Math.min(100, ((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100);
}

/** The skill level for an xp total (1 to 99), by binary search over {@link XP_TABLE}. */
export function levelForXp(xp: number): number {
  let low = 1;
  let high = MAX_SKILL_LEVEL;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (XP_TABLE[mid] <= xp) low = mid;
    else high = mid - 1;
  }
  return low;
}
