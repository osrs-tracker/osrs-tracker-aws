import { Player, PlayerStatus, PlayerType } from '@osrs-tracker/models';
import { Agent } from 'https';
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';
import { MU } from './mongo.utils';

/** Format: `rank,level,xp` */
export type HiscoreLine = string;
export type Hiscores = HiscoreLine[];

export async function refreshPlayerInfo(
  client: MongoClient,
  agent: Agent,
  username: string,
  savedPlayer?: Player,
): Promise<boolean> {
  if (savedPlayer?.type === PlayerType.Normal) throw new Error('Normal players should not be refreshed');

  const player = await determinePlayerStatusAndType(agent, username);
  if (player === null) return false;

  const { upsertedCount, modifiedCount } = await MU.upsertPlayer(client, player);
  if (!upsertedCount && !modifiedCount) throw new Error('Player failed to be upserted');

  return true;
}

async function determinePlayerStatusAndType(agent: Agent, username: string): Promise<Player | null> {
  const [normal, ironman, ultimate, hardcore] = await Promise.all([
    getHiscore(agent, username, PlayerType.Normal),
    getHiscore(agent, username, PlayerType.Ironman),
    getHiscore(agent, username, PlayerType.Ultimate),
    getHiscore(agent, username, PlayerType.Hardcore),
  ]);

  if (normal === null) return null;

  const type = determineType(ironman, ultimate, hardcore);
  const status = determineStatus(normal, ironman, ultimate);
  const diedAsHardcore = getTotalXp(hardcore) < getTotalXp(ironman);

  return {
    username,
    combatLevel: getCombatLevel(normal),
    type,
    status,
    diedAsHardcore,
    lastModified: new Date(),
  };
}

function getCombatLevel(hiscoreLines: Hiscores): number {
  // default to level 1 when not found (-1)
  const attack = Math.max(1, parseInt(hiscoreLines[1].split(',')[1]));
  const defence = Math.max(1, parseInt(hiscoreLines[2].split(',')[1]));
  const strength = Math.max(1, parseInt(hiscoreLines[3].split(',')[1]));
  const hitpoints = Math.max(1, parseInt(hiscoreLines[4].split(',')[1]));
  const ranged = Math.max(1, parseInt(hiscoreLines[6].split(',')[1]));
  const prayer = Math.max(1, parseInt(hiscoreLines[5].split(',')[1]));
  const magic = Math.max(1, parseInt(hiscoreLines[7].split(',')[1]));

  const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
  const melee = 0.325 * (attack + strength);
  const range = 0.325 * (Math.floor(ranged / 2) + ranged);
  const mage = 0.325 * (Math.floor(magic / 2) + magic);

  return Math.floor(base + Math.max(melee, range, mage));
}

function getHiscore(agent: Agent, username: string, type: PlayerType): Promise<Hiscores | null> {
  const hiscoreUrl = process.env.OSRS_API_BASE_URL + `/m=${getHiscorePrefix(type)}/index_lite.ws?player=${username}`;

  return fetch(hiscoreUrl, { agent, headers: { 'cache-control': 'no-cache' } }).then(async (res) =>
    res.ok ? (await res.text()).split('\n') : null,
  );
}

function getHiscorePrefix(type: PlayerType): string {
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

/** Analyses hiscores to determine original playerType. Only works when the player has enough xp to appear in the hiscores. */
function determineType(ironman: Hiscores | null, ultimate: Hiscores | null, hardcore: Hiscores | null): PlayerType {
  if (ultimate) return PlayerType.Ultimate;
  if (hardcore) return PlayerType.Hardcore;
  if (ironman) return PlayerType.Ironman;
  return PlayerType.Normal;
}

/** Analyses hiscores to determine current playerStatus. Only works when the player has enough xp to appear in the hiscores. */
function determineStatus(normal: Hiscores | null, ironman: Hiscores | null, ultimate: Hiscores | null): PlayerStatus {
  if (getTotalXp(ironman) < getTotalXp(normal)) return PlayerStatus.DeIroned;
  if (getTotalXp(ultimate) < getTotalXp(ironman)) return PlayerStatus.DeUltimated;
  return PlayerStatus.Default;
}

/** Transforms Hiscores into totalXp, so we can use it to compare hiscores. */
function getTotalXp(hiscoreLines: Hiscores | null): number {
  if (!hiscoreLines) return Number.MAX_SAFE_INTEGER;

  return Number(hiscoreLines?.[0].split(',')[2]);
}
