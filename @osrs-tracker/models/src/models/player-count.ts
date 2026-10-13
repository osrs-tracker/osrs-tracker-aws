/**
 * One sample of the number of players online, summed over Jagex's world list (the one the client's World Select uses). A
 * `playerCounts` document, written every 10 minutes by the record-player-count Lambda and kept forever.
 *
 * Slightly below the "people playing" on oldschool.runescape.com, which likely also counts players in the lobby.
 */
export interface PlayerCount {
  /** When the world list was fetched. */
  date: Date;

  /** Players on all worlds; `members + f2p`. An offline world counts as 0. */
  total: number;
  /** Players on members worlds. */
  members: number;
  /** Players on free-to-play worlds. */
  f2p: number;

  /** Worlds in the list, online or not. */
  worlds: number;

  /**
   * Players per world location, keyed by Jagex's raw location code as a string. RuneLite names 0 (US), 1 (UK), 3 (AU)
   * and 7 (DE); 8, 9, 10 and 12 were also seen (2026-10-13) and are unknown.
   */
  byLocation: Record<string, number>;
}
