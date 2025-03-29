import { HiscoreEntry } from './hiscores';

export enum PlayerType {
  Normal = 'normal',
  Ironman = 'ironman',
  Ultimate = 'ultimate',
  Hardcore = 'hardcore_ironman',
}

export enum PlayerStatus {
  Default = 'default',
  DeIroned = 'de_ironed',
  DeUltimated = 'de_ultimated',
}

export interface Player {
  username: string;
  combatLevel: number;
  type: PlayerType;
  status: PlayerStatus;
  diedAsHardcore: boolean;

  /** Last time the player type and status was determined. Will only update after at minimum 2 hours have passed. */
  lastModified: Date;
  /** Last time the hiscores were fetched for this player. Optional because it only exists when the player is tracked. */
  lastHiscoreFetch?: Date;

  /** offsets for scraping hiscores compared to UTC midnight, between -12 and +11. */
  scrapingOffsets?: number[];
  hiscoreEntries?: HiscoreEntry[];
}
