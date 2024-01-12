import { Player, PlayerStatus, PlayerType } from '@osrs-tracker/models';
import { Agent } from 'https';
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';
import { MU } from './mongo.utils';

/**
 * Refreshes the player info for the given `username`.
 *
 * @param scrapingOffset The `scrapingOffset` will be added to the player's `scrapingOffsets` if not already present.
 * @param initialScrape If true, will also add an initial `hiscoreEntry` for this `scrapingOffset`.
 * @returns
 */
export async function refreshPlayerInfo(
  client: MongoClient,
  agent: Agent,
  username: string,
  scrapingOffset: number,
  initialScrape: boolean,
): Promise<boolean> {
  const [player, sourceString] = await determinePlayerStatusAndType(agent, username);

  if (player === null) return false;

  const { upsertedCount, modifiedCount } = await MU.upsertPlayer(
    client,
    player,
    scrapingOffset,
    initialScrape,
    sourceString,
  );

  if (!upsertedCount && !modifiedCount) throw new Error('Player failed to be upserted');

  return true;
}

/** Returns determined player if determined, and normal sourceString, */
async function determinePlayerStatusAndType(agent: Agent, username: string): Promise<[Player | null, string]> {
  const [normal, ironman, ultimate, hardcore] = await Promise.all([
    getHiscore(agent, username, PlayerType.Normal),
    getHiscore(agent, username, PlayerType.Ironman),
    getHiscore(agent, username, PlayerType.Ultimate),
    getHiscore(agent, username, PlayerType.Hardcore),
  ]);

  if (normal === null) return [null, ''];

  const type = determineType(ironman, ultimate, hardcore);
  const status = determineStatus(normal, ironman, ultimate);
  const diedAsHardcore = getTotalXp(hardcore) < getTotalXp(ironman);

  return [
    {
      username,
      combatLevel: getCombatLevel(normal),
      type,
      status,
      diedAsHardcore,
      lastModified: new Date(),
    },
    normal,
  ];
}

function getHiscore(agent: Agent, username: string, type: PlayerType): Promise<string | null> {
  const hiscoreUrl = process.env.OSRS_API_BASE_URL + `/m=${getHiscoreTable(type)}/index_lite.ws?player=${username}`;

  return fetch(hiscoreUrl, { agent, headers: { 'cache-control': 'no-cache' } }).then(async (res) =>
    res.ok ? res.text() : null,
  );
}

/** Resolve correct hiscore table for `PlayerType`. */
function getHiscoreTable(type: PlayerType): string {
  switch (type) {
    case PlayerType.Normal:
      return 'hiscore_oldschool';
    case PlayerType.Ironman:
      return 'hiscore_oldschool_ironman';
    case PlayerType.Ultimate:
      return 'hiscore_oldschool_ultimate';
    case PlayerType.Hardcore:
      return 'hiscore_oldschool_hardcore_ironman';
  }
}

/** Transforms sourceString into combatLevel. */
function getCombatLevel(sourceString: string): number {
  const hiscoreLines = sourceString.split('\n');

  // default to level 1 when not found (-1)
  const attack = Math.max(1, parseInt(hiscoreLines[1].split(',')[1]));
  const defence = Math.max(1, parseInt(hiscoreLines[2].split(',')[1]));
  const strength = Math.max(1, parseInt(hiscoreLines[3].split(',')[1]));
  const hitpoints = Math.max(1, parseInt(hiscoreLines[4].split(',')[1]));
  const ranged = Math.max(1, parseInt(hiscoreLines[5].split(',')[1]));
  const prayer = Math.max(1, parseInt(hiscoreLines[6].split(',')[1]));
  const magic = Math.max(1, parseInt(hiscoreLines[7].split(',')[1]));

  const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
  const melee = 0.325 * (attack + strength);
  const range = 0.325 * (Math.floor(ranged / 2) + ranged);
  const mage = 0.325 * (Math.floor(magic / 2) + magic);

  return Math.floor(base + Math.max(melee, range, mage));
}

/** Analyses sourceString to determine original playerType. Only works when the player has enough xp to appear in the hiscores. */
function determineType(ironman: string | null, ultimate: string | null, hardcore: string | null): PlayerType {
  if (ultimate) return PlayerType.Ultimate;
  if (hardcore) return PlayerType.Hardcore;
  if (ironman) return PlayerType.Ironman;
  return PlayerType.Normal;
}

/** Analyses sourceString to determine current playerStatus. Only works when the player has enough xp to appear in the hiscores. */
function determineStatus(normal: string | null, ironman: string | null, ultimate: string | null): PlayerStatus {
  if (getTotalXp(ironman) < getTotalXp(normal)) return PlayerStatus.DeIroned;
  if (getTotalXp(ultimate) < getTotalXp(ironman)) return PlayerStatus.DeUltimated;
  return PlayerStatus.Default;
}

/** Transforms sourceString into totalXp, so we can use it to compare hiscores. */
function getTotalXp(hiscoreLines: string | null): number {
  if (!hiscoreLines) return Number.MAX_SAFE_INTEGER;

  return Number(hiscoreLines.split('\n')[0].split(',')[2]);
}
