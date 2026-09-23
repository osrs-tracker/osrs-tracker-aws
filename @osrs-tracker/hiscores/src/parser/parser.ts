import { HiscoreActivity, HiscoreEntry, HiscoreSkill } from '@osrs-tracker/models';
import { isAfter, parseISO } from 'date-fns';
import { ActivityEnum, SkillEnum } from '../models/hiscore.enum';
import { ParseOrder, ParseOrderMap } from './parse-order/parse-order';
import { PO_DEFAULT } from './parse-order/po-default';

/**
 * Parses a list of hiscore entries into a list of hiscores.
 *
 * It will attempt to use the `skills` and `activities` properties of each hiscore entry if they are present.
 * If they are not present, it will fall back to parsing the `sourceString` property of each hiscore entry.
 *
 * @param hiscoreEntries The hiscore entries to parse.
 *
 * @returns The parsed hiscores.
 */
export function parseHiscores(hiscoreEntries: HiscoreEntry[]): HiscoreEntry[] {
  return hiscoreEntries.map((hiscoreEntry) => {
    if (hiscoreEntry.skills && hiscoreEntry.activities) return hiscoreEntry;
    // Fall back to parsing the source string if skills and activities are not present
    return {
      ...hiscoreEntry,
      ...parseHiscoreString(hiscoreEntry.sourceString, hiscoreEntry.date),
    };
  });
}

/**
 * Returns the difference between two hiscores as a new Hiscore object.
 *
 * @param recent The most recent hiscore.
 * @param old The older hiscore.
 *
 * @returns The difference between the two hiscores.
 */
export function hiscoreDiff(recent: HiscoreEntry, old: HiscoreEntry): HiscoreEntry {
  const diffEntries = Object.entries(recent).map(([hiscoreKey, recentValue]) => {
    switch (hiscoreKey) {
      case 'date':
      case 'sourceString':
      case 'scrapingOffset':
        return [hiscoreKey, old[hiscoreKey]];
      case 'skills':
        return [
          'skills',
          (recentValue as HiscoreEntry['skills']).map((skill) => {
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
          (recentValue as HiscoreEntry['activities']).map((activity) => {
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

/**
 * Returns the difference in overall xp between two hiscore entries.
 *
 * @param today The most recent hiscore entry.
 * @param recent The older hiscore entry.
 *
 * @returns The difference in overall xp between the two hiscore entries.
 */
export function getOverallXpDiff(today: HiscoreEntry, recent: HiscoreEntry): number {
  const todayOverall = (today.skills ?? parseHiscoreString(today.sourceString, today.date).skills).find(
    (s) => s.name === SkillEnum.Overall,
  );
  const recentOverall = (recent.skills ?? parseHiscoreString(recent.sourceString, recent.date).skills).find(
    (s) => s.name === SkillEnum.Overall,
  );

  return diff(todayOverall?.xp ?? 0, recentOverall?.xp ?? 0);
}

/**
 * Converts hiscore JSON data to a source string.
 *
 * @param skills The skills data from the hiscore JSON.
 * @param activities The activities data from the hiscore JSON.
 *
 * @returns A string representation of the hiscore data.
 */
export function hiscoreJsonToSourceString({
  skills,
  activities,
}: {
  skills: HiscoreSkill[];
  activities: HiscoreActivity[];
}): string {
  return [
    skills.flatMap((skill) => [skill.rank, skill.level, skill.xp].join(',')),
    activities.flatMap((activity) => [activity.rank, activity.score].join(',')),
  ]
    .flat()
    .join('\n');
}

/**
 * Parses a hiscore string into a hiscore object. Exposed for testing purposes.
 *
 * @internal
 */
export function parseHiscoreString(hiscoreString: string, date: Date): Pick<HiscoreEntry, 'skills' | 'activities'> {
  const parser = getCurrentParser(date);
  const lines = hiscoreString.split('\n').filter((line) => line.length);
  const skillsInPO = parser.filter((val) => Object.values(SkillEnum).includes(val as SkillEnum)).length;

  // Create a new hiscore object with skills and minigame placeholders
  return {
    skills: lines.slice(0, skillsInPO).map((line, i) => parseSkillLine(parser, line, i)),
    activities: lines.slice(skillsInPO).map((line, i) => parseActivityLine(parser, line, i + skillsInPO)),
  };
}

function getCurrentParser(dateToParse: Date): ParseOrder {
  for (const [parseDate, parser] of Object.entries(ParseOrderMap)) {
    if (isAfter(dateToParse, parseISO(parseDate))) {
      return parser;
    }
  }
  return PO_DEFAULT;
}

function parseSkillLine(parseOrder: ParseOrder, line: string, lineNo: number): HiscoreSkill {
  const [rank, level, xp] = line.split(',');

  return {
    id: Object.values(SkillEnum).findIndex((skill) => skill === parseOrder[lineNo]),
    name: parseOrder[lineNo] as SkillEnum,
    rank: parseInt(rank),
    level: parseInt(level),
    xp: parseInt(xp),
  };
}

function parseActivityLine(parseOrder: ParseOrder, line: string, lineNo: number): HiscoreActivity {
  const [rank, score] = line.split(',');

  return {
    id: Object.values(ActivityEnum).findIndex((activity) => activity === parseOrder[lineNo]),
    name: parseOrder[lineNo] as ActivityEnum,
    rank: parseInt(rank),
    score: parseInt(score),
  };
}

/** For some reason skills and activities can have 0 or -1 exp in the hiscore API. */
function diff(a: number, b: number): number {
  return Math.max(a, 0) - Math.max(b, 0);
}
