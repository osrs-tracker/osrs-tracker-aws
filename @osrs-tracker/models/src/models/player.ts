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

export class Player {
  public username: string;
  public type: PlayerType;
  public status: PlayerStatus;
  public diedAsHardcore: boolean;
  public lastModified: Date;
  /** offsets for scraping hiscores compared to UTC midnight, between -12 and +11 */
  public scrapingOffsets?: number[]; // optional because it only exists when the player is tracked
}

export class PlayerWithHiscores extends Player {
  public hiscoreEntries?: HiscoreEntry[]; // optional because it only exists when the player is tracked
}
