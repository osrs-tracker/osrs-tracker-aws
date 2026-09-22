import { isAfter, parseISO } from 'date-fns';
import { SkillEnum } from '../models/hiscore.enum';
import { ParseOrderMap } from './parse-order/parse-order';
import { PO_DEFAULT } from './parse-order/po-default';
export function parseHiscores(hiscoreEntries) {
    return hiscoreEntries.map((hiscoreEntry) => ({
        ...hiscoreEntry,
        ...parseHiscoreString(hiscoreEntry.sourceString, hiscoreEntry.date),
    }));
}
export function hiscoreDiff(recent, old) {
    const diffEntries = Object.entries(recent).map(([hiscoreKey, recentValue]) => {
        switch (hiscoreKey) {
            case 'date':
            case 'sourceString':
            case 'scrapingOffset':
                return [hiscoreKey, old[hiscoreKey]];
            case 'parsedSkills':
                return [
                    hiscoreKey,
                    Object.fromEntries(Object.entries(recentValue).map(([skillName, skill]) => [
                        skillName,
                        {
                            name: skillName,
                            rank: skill.rank - (old.parsedSkills[skillName]?.rank ?? 0),
                            level: skill.level - (old.parsedSkills[skillName]?.level ?? 0),
                            xp: diff(skill.xp, old.parsedSkills[skillName]?.xp ?? 0),
                        },
                    ])),
                ];
            case 'parsedActivities':
                return [
                    hiscoreKey,
                    Object.fromEntries(Object.entries(recentValue).map(([activityName, activity]) => [
                        activityName,
                        {
                            name: activityName,
                            rank: activity.rank - (old.parsedActivities[activityName]?.rank ?? 0),
                            score: diff(activity.score, old.parsedActivities[activityName]?.score ?? 0),
                        },
                    ])),
                ];
            default:
                throw new Error('Unknown hiscore key: ' + hiscoreKey);
        }
    });
    return Object.fromEntries(diffEntries);
}
export function getOverallXpDiff(today, recent) {
    const todayOverall = getSkillFromSourceString(today.sourceString, SkillEnum.Overall, today.date);
    const recentOverall = getSkillFromSourceString(recent.sourceString, SkillEnum.Overall, recent.date);
    return diff(todayOverall.xp, recentOverall.xp);
}
export function parseHiscoreString(hiscoreString, date) {
    const parser = getCurrentParser(date);
    const lines = hiscoreString.split('\n').filter((line) => line.length);
    const skillsInPO = parser.filter((val) => Object.values(SkillEnum).includes(val)).length;
    const skills = lines.slice(0, skillsInPO).map((line, i) => parseSkillLine(parser, line, i));
    const activities = lines.slice(skillsInPO).map((line, i) => parseActivityLine(parser, line, i + skillsInPO));
    const hiscore = {
        parsedSkills: skills.reduce((acc, val) => (acc = { ...acc, [val.name]: val }), {}),
        parsedActivities: activities.reduce((acc, val) => (acc = { ...acc, [val.name]: val }), {}),
    };
    return hiscore;
}
function getSkillFromSourceString(sourceString, skill, date) {
    const parser = getCurrentParser(date);
    const lines = sourceString.split('\n').filter((line) => line.length);
    const overallLineNo = parser.indexOf(skill);
    return parseSkillLine(parser, lines[overallLineNo], overallLineNo);
}
function getCurrentParser(dateToParse) {
    for (const [parseDate, parser] of Object.entries(ParseOrderMap)) {
        if (isAfter(dateToParse, parseISO(parseDate))) {
            return parser;
        }
    }
    return PO_DEFAULT;
}
function diff(a, b) {
    return Math.max(a, 0) - Math.max(b, 0);
}
function parseSkillLine(parseOrder, line, lineNo) {
    const [rank, level, xp] = line.split(',');
    return {
        name: parseOrder[lineNo],
        rank: parseInt(rank),
        level: parseInt(level),
        xp: parseInt(xp),
    };
}
function parseActivityLine(parseOrder, line, lineNo) {
    const [rank, score] = line.split(',');
    return {
        name: parseOrder[lineNo],
        rank: parseInt(rank),
        score: parseInt(score),
    };
}
