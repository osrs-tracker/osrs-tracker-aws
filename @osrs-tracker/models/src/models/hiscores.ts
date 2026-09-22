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

  /** @deprecated Use `skills` and `activities` instead. This will be removed in a future version. */
  sourceString: string;
}
