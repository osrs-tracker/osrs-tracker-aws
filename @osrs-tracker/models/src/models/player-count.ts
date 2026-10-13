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
   * Players per world location, keyed by Jagex's raw location code as a string: 0 United States (east and west
   * together), 1 United Kingdom, 3 Australia, 7 Germany, 8 Brazil, 9 Japan, 10 Singapore, 12 South Africa (8 to 12
   * matched on 2026-10-13 by their worlds' numbers). A new code can appear when Jagex adds a location.
   */
  byLocation: Record<string, number>;
}
