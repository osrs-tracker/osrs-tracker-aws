import { PlayerCount } from './player-count.js';

/**
 * The averages over one UTC day of `PlayerCount` samples. A `playerCountsDaily` document, recomputed from the samples
 * by the record-player-count Lambda on every run (normally only today's), so today's is partial. A day without samples
 * has no document.
 *
 * Averages are rounded half to even (MongoDB's `$round`), so `members + f2p` can be one off `total`.
 */
export interface PlayerCountDay {
  /** The start of the UTC day; unique. */
  date: Date;

  /** The day's average `total`. */
  total: number;
  /** The day's average `members`. */
  members: number;
  /** The day's average `f2p`. */
  f2p: number;

  /**
   * The average players per location code (see `PlayerCount['byLocation']`), over the samples that have the code: a
   * code that appeared mid-day averages only the samples since.
   */
  byLocation: PlayerCount['byLocation'];

  /** The highest `total` sampled that day. */
  peak: number;
  /** How many samples the day averages: 144 for a whole day at one every 10 minutes, fewer for today or a gap. */
  samples: number;
}
