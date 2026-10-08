"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hiscoreDiff = hiscoreDiff;
exports.getOverallXpDiff = getOverallXpDiff;
const hiscore_enum_js_1 = require("../models/hiscore.enum.js");
function hiscoreDiff(recent, old) {
    const diffEntries = Object.entries(recent).map(([hiscoreKey, recentValue]) => {
        switch (hiscoreKey) {
            case 'skills':
                return [
                    'skills',
                    recentValue.map((skill) => {
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
                    recentValue.map((activity) => {
                        const oldActivity = old.activities.find((a) => a.name === activity.name);
                        return {
                            ...activity,
                            rank: activity.rank - (oldActivity?.rank ?? 0),
                            score: diff(activity.score, oldActivity?.score ?? 0),
                        };
                    }),
                ];
            default:
                return [hiscoreKey, old[hiscoreKey]];
        }
    });
    return Object.fromEntries(diffEntries);
}
function getOverallXpDiff(today, recent) {
    const todayOverall = today.skills.find((s) => s.name === hiscore_enum_js_1.SkillEnum.Overall);
    const recentOverall = recent.skills.find((s) => s.name === hiscore_enum_js_1.SkillEnum.Overall);
    return diff(todayOverall?.xp ?? 0, recentOverall?.xp ?? 0);
}
function diff(a, b) {
    return Math.max(a, 0) - Math.max(b, 0);
}
