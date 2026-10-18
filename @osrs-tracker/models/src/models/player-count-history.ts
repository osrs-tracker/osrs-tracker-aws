import { PlayerCount } from './player-count.js';

/**
 * The ranges of osrs-tracker-api's `GET /player-counts?range=`, and their points: every `PlayerCount` sample (24h, 7d),
 * hourly averages (30d) or the `PlayerCountDay` averages (1y, all).
 */
export const PLAYER_COUNT_RANGES = ['24h', '7d', '30d', '1y', 'all'] as const;
export type PlayerCountRange = (typeof PLAYER_COUNT_RANGES)[number];

/**
 * One point of the history `GET /player-counts?range=` returns, oldest first: a sample, or the averages over the UTC
 * hour or day starting at `date`.
 */
export interface PlayerCountPoint {
  date: Date;
  total: number;
  members: number;
  f2p: number;
  /** Players per raw location code (`PlayerCount['byLocation']`); in a bucket, the average per code. */
  byLocation: PlayerCount['byLocation'];
  /** Daily points only: the highest `total` sampled that day. */
  peak?: number;
}
