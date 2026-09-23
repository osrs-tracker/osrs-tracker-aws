import { isAfter, parseISO } from 'date-fns';
import { ActivityEnum, SkillEnum } from '../models/hiscore.enum';
import { ParseOrderMap } from './parse-order/parse-order';
import { PO_DEFAULT } from './parse-order/po-default';
export function parseHiscores(hiscoreEntries) {
    return hiscoreEntries.map((hiscoreEntry) => {
        if (hiscoreEntry.skills && hiscoreEntry.activities)
            return hiscoreEntry;
        return {
            ...hiscoreEntry,
            ...parseHiscoreString(hiscoreEntry.sourceString, hiscoreEntry.date),
        };
    });
}
export function hiscoreDiff(recent, old) {
    const diffEntries = Object.entries(recent).map(([hiscoreKey, recentValue]) => {
        switch (hiscoreKey) {
            case 'date':
            case 'sourceString':
            case 'scrapingOffset':
                return [hiscoreKey, old[hiscoreKey]];
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
                throw new Error('Unknown hiscore key: ' + hiscoreKey);
        }
    });
    return Object.fromEntries(diffEntries);
}
export function getOverallXpDiff(today, recent) {
    const todayOverall = (today.skills ?? parseHiscoreString(today.sourceString, today.date).skills).find((s) => s.name === SkillEnum.Overall);
    const recentOverall = (recent.skills ?? parseHiscoreString(recent.sourceString, recent.date).skills).find((s) => s.name === SkillEnum.Overall);
    return diff(todayOverall?.xp ?? 0, recentOverall?.xp ?? 0);
}
export function hiscoreJsonToSourceString({ skills, activities, }) {
    return [
        skills.flatMap((skill) => [skill.rank, skill.level, skill.xp].join(',')),
        activities.flatMap((activity) => [activity.rank, activity.score].join(',')),
    ]
        .flat()
        .join('\n');
}
export function parseHiscoreString(hiscoreString, date) {
    const parser = getCurrentParser(date);
    const lines = hiscoreString.split('\n').filter((line) => line.length);
    const skillsInPO = parser.filter((val) => Object.values(SkillEnum).includes(val)).length;
    return {
        skills: lines.slice(0, skillsInPO).map((line, i) => parseSkillLine(parser, line, i)),
        activities: lines.slice(skillsInPO).map((line, i) => parseActivityLine(parser, line, i + skillsInPO)),
    };
}
function getCurrentParser(dateToParse) {
    for (const [parseDate, parser] of Object.entries(ParseOrderMap)) {
        if (isAfter(dateToParse, parseISO(parseDate))) {
            return parser;
        }
    }
    return PO_DEFAULT;
}
function parseSkillLine(parseOrder, line, lineNo) {
    const [rank, level, xp] = line.split(',');
    return {
        id: Object.values(SkillEnum).findIndex((skill) => skill === parseOrder[lineNo]),
        name: parseOrder[lineNo],
        rank: parseInt(rank),
        level: parseInt(level),
        xp: parseInt(xp),
    };
}
function parseActivityLine(parseOrder, line, lineNo) {
    const [rank, score] = line.split(',');
    return {
        id: Object.values(ActivityEnum).findIndex((activity) => activity === parseOrder[lineNo]),
        name: parseOrder[lineNo],
        rank: parseInt(rank),
        score: parseInt(score),
    };
}
function diff(a, b) {
    return Math.max(a, 0) - Math.max(b, 0);
}
