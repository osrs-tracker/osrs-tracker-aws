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
  constructor(
    public username: string,
    public type: PlayerType = PlayerType.Normal,
    public status: PlayerStatus = PlayerStatus.Default,
    public diedAsHardcore: boolean = false,
    public lastModified: Date = new Date(),
    public hiscoreEntries?: HiscoreEntry[],
    /** offsets for scraping hiscores compared to UTC midnight, between -12 and +11 */
    public scrapingOffsets?: number[],
  ) {}
}
