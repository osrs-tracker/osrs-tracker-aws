import { HiscoreEntry } from './hiscores';
export declare enum PlayerType {
    Normal = "normal",
    Ironman = "ironman",
    Ultimate = "ultimate",
    Hardcore = "hardcore_ironman"
}
export declare enum PlayerStatus {
    Default = "default",
    DeIroned = "de_ironed",
    DeUltimated = "de_ultimated"
}
export interface Player {
    username: string;
    combatLevel: number;
    type: PlayerType;
    status: PlayerStatus;
    diedAsHardcore: boolean;
    lastModified: Date;
    lastHiscoreFetch?: Date;
    scrapingOffsets?: number[];
    hiscoreEntries?: HiscoreEntry[];
}
//# sourceMappingURL=player.d.ts.map