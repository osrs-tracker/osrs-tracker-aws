import { HiscoreEntry } from '@osrs-tracker/models';
import { Hiscore } from '../models/hiscore.model';
export declare function parseHiscores(hiscoreEntries: HiscoreEntry[]): Hiscore[];
export declare function hiscoreDiff(recent: Hiscore, old: Hiscore): Hiscore;
export declare function getOverallXpDiff(today: HiscoreEntry, recent: HiscoreEntry): number;
export declare function parseHiscoreString(hiscoreString: string, date: Date): Omit<Hiscore, keyof HiscoreEntry>;
