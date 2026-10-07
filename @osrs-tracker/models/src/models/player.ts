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

  /**
   * Last time osrs-tracker-api determined the player type and status. Refreshed on a lookup at most every
   * `minPlayerRefreshTime` hours (2), or sooner when the player lacks the requested scraping offset.
   */
  lastModified: Date;
  /**
   * Last time a visitor looked the player up; orders the recent players list. Set by osrs-tracker-api on every lookup
   * of a stored player, tracked or not. Not the last hiscores scrape: that is the newest `hiscoreEntries` entry's
   * `date` for the offset.
   */
  lastHiscoreFetch?: Date;

  /** offsets for scraping hiscores compared to UTC midnight, between -12 and +11. */
  scrapingOffsets?: number[];
  /**
   * Scraping offsets that were paused because the player hasn't been on the hiscores (HTTP 404) for 7 days in a row.
   * Restored to `scrapingOffsets` when the player is found again.
   */
  pausedScrapingOffsets?: number[];
  /** Number of consecutive hiscore fetches that returned "not found". Reset on the next successful fetch. */
  hiscoreNotFoundCount?: number;
  /** Date of the first hiscore fetch in the current "not found" streak. Reset on the next successful fetch. */
  hiscoreNotFoundSince?: Date;
  hiscoreEntries?: HiscoreEntry[];

  /**
   * Date of the oldest stored hiscore entry for the requested `scrapingOffset`, `null` when there are none.
   * Computed by `GET /players/:username` in osrs-tracker-api, never stored.
   */
  trackedSince?: Date | null;
  /**
   * True when osrs-tracker-api couldn't refresh the player because the hiscores didn't respond (outage, rate limit,
   * timeout), so the returned data may be stale. Set by `GET /players/:username`, never stored.
   */
  refreshFailed?: boolean;
}
