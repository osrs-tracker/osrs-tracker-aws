export function calculateXPForSkillLevel(level) {
    let total = 0;
    for (let i = 1; i < level; i++) {
        total += Math.floor(i + 300 * Math.pow(2, i / 7));
    }
    return Math.floor(total / 4);
}
export function calculateXPToNextLevel(currentXP, currentLevel) {
    const totalXPNextLevel = calculateXPForSkillLevel(currentLevel + 1);
    return totalXPNextLevel - currentXP;
}
