export interface HiscoreItem {
    id: number;
    name: string;
    rank: number;
}
export interface HiscoreSkill extends HiscoreItem {
    level: number;
    xp: number;
}
export interface HiscoreActivity extends HiscoreItem {
    score: number;
}
export interface HiscoreEntry {
    date: Date;
    scrapingOffset: number;
    skills: HiscoreSkill[];
    activities: HiscoreActivity[];
    sourceString: string;
}
//# sourceMappingURL=hiscores.d.ts.map