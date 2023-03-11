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
export declare class Player {
    username: string;
    type: PlayerType;
    status: PlayerStatus;
    diedAsHardcore: boolean;
    lastModified: Date;
}
export declare class PlayerWithHiscores extends Player {
    hiscoreEntries: HiscoreEntry[];
    scrapingOffsets: number[];
}
