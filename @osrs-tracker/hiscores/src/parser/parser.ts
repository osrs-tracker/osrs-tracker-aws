import { HiscoreEntry } from '@osrs-tracker/models';
import { addHours, isAfter, parseISO } from 'date-fns';
import {
  BossEnum,
  BountyHunterEnum,
  ClueScrollsEnum,
  CompetitiveEnum,
  MiniGameEnum,
  RaidEnum,
  SkillEnum,
} from '../models/hiscore.enum';
import { Hiscore, MiniGame, Skill } from '../models/hiscore.model';
import { ParseOrder, ParseOrderMap } from './parse-order/parse-order';
import { PO_DEFAULT } from './parse-order/po-default';

/**
 * Parses a list of hiscore entries into a list of hiscores.
 *
 * @param hiscoreEntries The hiscore entries to parse.
 *
 * @returns The parsed hiscores.
 */
export function parseHiscores(hiscoreEntries: HiscoreEntry[]): Hiscore[] {
  return hiscoreEntries.map(
    (hiscoreEntry) =>
      ({
        ...hiscoreEntry,
        ...parseHiscoreString(hiscoreEntry.sourceString, hiscoreEntry.date),
      } as Hiscore),
  );
}

/**
 * Returns the difference between two hiscores as a new Hiscore object.
 *
 * @param recent The most recent hiscore.
 * @param old The older hiscore.
 *
 * @returns The difference between the two hiscores.
 */
export function hiscoreDiff(recent: Hiscore, old: Hiscore): Hiscore {
  const diffEntries = Object.entries(recent).map(([hiscoreKey, recentValue]) => {
    switch (hiscoreKey) {
      case 'date':
      case 'sourceString':
      case 'scrapingOffset':
        return [hiscoreKey, old[hiscoreKey]];
      case 'skills':
        return [
          hiscoreKey,
          Object.fromEntries(
            Object.entries<Skill>(recentValue).map(([skillName, skill]) => [
              skillName,
              {
                name: skillName,
                rank: skill.rank - old.skills[skillName as SkillEnum].rank,
                level: skill.level - old.skills[skillName as SkillEnum].level,
                xp: diff(skill.xp, old.skills[skillName as SkillEnum].xp),
              },
            ]),
          ),
        ];
      case 'bosses':
      case 'raids':
      case 'clueScrolls':
      case 'competitive':
      case 'bountyHunter':
      case 'miniGames':
        return [
          hiscoreKey,
          Object.fromEntries(
            Object.entries<MiniGame>(recentValue).map(([miniGameName, miniGame]) => [
              miniGameName,
              {
                name: miniGameName,
                rank: miniGame.rank - ((old[hiscoreKey] as { [key: string]: MiniGame })[miniGameName]?.rank ?? 0),
                score: diff(miniGame.score, (old[hiscoreKey] as { [key: string]: MiniGame })[miniGameName]?.score ?? 0),
              },
            ]),
          ),
        ];
      default:
        throw new Error('Unknown hiscore key: ' + hiscoreKey);
    }
  });

  return Object.fromEntries(diffEntries) as Hiscore;
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
  const todayOverall = getSkillFromSourceString(today.sourceString, SkillEnum.Overall, today.date);
  const recentOverall = getSkillFromSourceString(recent.sourceString, SkillEnum.Overall, recent.date);

  return diff(todayOverall.xp, recentOverall.xp);
}

/**
 * Parses a hiscore string into a hiscore object. Exposed for testing purposes.
 *
 * @internal
 */
export function parseHiscoreString(hiscoreString: string, date: Date): Omit<Hiscore, keyof HiscoreEntry> {
  const parser = getCurrentParser(date);

  const lines = hiscoreString.split('\n').filter((line) => line.length);

  const skillsInPO = parser.filter((val) => Object.values(SkillEnum).includes(val as SkillEnum)).length;

  // skills are the first entries, after that come the minigames
  const skills = lines.slice(0, skillsInPO).map((line, i) => parseSkillLine(parser, line, i));
  const minigames = lines.slice(skillsInPO).map((line, i) => parseMiniGameLine(parser, line, i + skillsInPO));

  // Create a new hiscore object with skills and minigame placeholders
  const hiscore = {
    skills: skills.reduce((acc, val) => (acc = { ...acc, [val.name]: val }), {}),
    bosses: {},
    raids: {},
    clueScrolls: {},
    competitive: {},
    bountyHunter: {},
    miniGames: {},
  } as Hiscore;

  // Fill the minigame placeholders
  minigames.forEach((miniGame) => {
    if (Object.values(BossEnum).includes(miniGame.name as BossEnum))
      return (hiscore.bosses[miniGame.name as BossEnum] = miniGame);

    if (Object.values(RaidEnum).includes(miniGame.name as RaidEnum))
      return (hiscore.raids[miniGame.name as RaidEnum] = miniGame);

    if (Object.values(ClueScrollsEnum).includes(miniGame.name as ClueScrollsEnum))
      return (hiscore.clueScrolls[miniGame.name as ClueScrollsEnum] = miniGame);

    if (Object.values(CompetitiveEnum).includes(miniGame.name as CompetitiveEnum))
      return (hiscore.competitive[miniGame.name as CompetitiveEnum] = miniGame);

    if (Object.values(BountyHunterEnum).includes(miniGame.name as BountyHunterEnum))
      return (hiscore.bountyHunter[miniGame.name as BountyHunterEnum] = miniGame);

    if (Object.values(MiniGameEnum).includes(miniGame.name as MiniGameEnum))
      return (hiscore.miniGames[miniGame.name as MiniGameEnum] = miniGame);

    // When a minigame can't be found in the current parse order, throw an error
    throw new Error('Unknown minigame detected:' + miniGame.name);
  });

  return hiscore;
}

function getSkillFromSourceString(sourceString: string, skill: SkillEnum, date: Date): Skill {
  const parser = getCurrentParser(date);

  const lines = sourceString.split('\n').filter((line) => line.length);
  const overallLineNo = parser.indexOf(skill);

  return parseSkillLine(parser, lines[overallLineNo], overallLineNo);
}

function getCurrentParser(dateToParse: Date): ParseOrder {
  for (const [parseDate, parser] of Object.entries(ParseOrderMap)) {
    if (isAfter(dateToParse, addHours(parseISO(parseDate), 11))) {
      return parser;
    }
  }
  return PO_DEFAULT;
}

/**
 *  For some reason for free to play people membership skills can have 0 or -1 exp in the hiscore API.
 *  Default to zero to fix ghost exp in membership skills (+1 exp).
 *
 *  Also used for minigames, where the score can be -1 when unranked.
 */
function diff(a: number, b: number): number {
  return Math.max(a, 0) - Math.max(b, 0);
}

function parseSkillLine(parseOrder: ParseOrder, line: string, lineNo: number): Skill {
  const [rank, level, xp] = line.split(',');

  return {
    name: parseOrder[lineNo] as SkillEnum,
    rank: parseInt(rank),
    level: parseInt(level),
    xp: parseInt(xp),
  };
}

function parseMiniGameLine(parseOrder: ParseOrder, line: string, lineNo: number): MiniGame {
  const [rank, score] = line.split(',');

  return {
    name: parseOrder[lineNo] as MiniGameEnum | RaidEnum | BossEnum,
    rank: parseInt(rank),
    score: parseInt(score),
  };
}
