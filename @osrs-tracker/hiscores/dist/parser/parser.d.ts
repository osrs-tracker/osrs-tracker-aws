import { HiscoreActivity, HiscoreEntry, HiscoreSkill } from '@osrs-tracker/models';
export declare function parseHiscores(hiscoreEntries: HiscoreEntry[]): HiscoreEntry[];
export declare function hiscoreDiff(recent: HiscoreEntry, old: HiscoreEntry): HiscoreEntry;
export declare function getOverallXpDiff(today: HiscoreEntry, recent: HiscoreEntry): number;
export declare function hiscoreJsonToSourceString({ skills, activities, }: {
    skills: HiscoreSkill[];
    activities: HiscoreActivity[];
}): string;
export declare function parseHiscoreString(hiscoreString: string, date: Date): Pick<HiscoreEntry, 'skills' | 'activities'>;
