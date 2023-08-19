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
  lastModified: Date;

  /** offsets for scraping hiscores compared to UTC midnight, between -12 and +11 */
  scrapingOffsets?: number[]; // optional because it only exists when the player is tracked
  hiscoreEntries?: HiscoreEntry[]; // optional because it only exists when the player is tracked
}
