export const enum PlayerType {
  Normal = 'normal',
  Ironman = 'ironman',
  Ultimate = 'ultimate',
  Hardcore = 'hardcore_ironman',
}

export const enum PlayerStatus {
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
  ) {}
}

export type Hiscores = HiscoreLine[];

/** Format: `rank,level,xp` */
export type HiscoreLine = string;
