import { HiscoreEntry, HiscoreLayoutNames } from '@osrs-tracker/models';
import { fromJagex, JagexHiscoreJson, MappedHiscore } from '../mapper/from-jagex.js';

/** The hiscore tables a player can be on. Everyone is on `hiscore_oldschool`; ironmen are also on their own tables. */
export type HiscoreTable =
  | 'hiscore_oldschool'
  | 'hiscore_oldschool_ironman'
  | 'hiscore_oldschool_ultimate'
  | 'hiscore_oldschool_hardcore_ironman';

/**
 * - `found`: the hiscore was fetched and mapped with {@link fromJagex}. Add `date` and `scrapingOffset` to `hiscore` for
 *   a `HiscoreEntry`; `layout` is its names in Jagex's order, for `layoutId`/`createHiscoreLayout` in models.
 * - `notFound`: HTTP 404 (or 400 for an invalid name), the player is not on this table (renamed, banned, unranked or
 *   not that account type). Permanent, so don't retry.
 * - `failed`: other non-2xx, network error, timeout or unexpected body. Worth retrying; `reason` is for logging.
 */
export type HiscoreResult =
  | {
      status: 'found';
      hiscore: Pick<HiscoreEntry, 'skills' | 'activities'>;
      layout: HiscoreLayoutNames;
    }
  | { status: 'notFound'; httpStatus: 400 | 404 }
  | { status: 'failed'; reason: string };

/** The part of `fetch` the client uses, so callers can pass global `fetch` or wrap `node-fetch` with their own agent. */
export type HiscoreFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown> }>;

export type GetHiscoreOptions = {
  /** Origin of the hiscores, e.g. `https://secure.runescape.com`. */
  baseUrl: string;
  username: string;
  /** Defaults to `hiscore_oldschool`. */
  table?: HiscoreTable;
  /** Defaults to the global `fetch`. */
  fetch?: HiscoreFetch;
  /** Max time for the request, defaults to 10 seconds. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

/** Fetches one player's hiscore from one table. Never throws: every outcome is a {@link HiscoreResult}. */
export async function getHiscore({
  baseUrl,
  username,
  table = 'hiscore_oldschool',
  fetch: fetchFn = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: GetHiscoreOptions): Promise<HiscoreResult> {
  const url = `${baseUrl}/m=${table}/index_lite.json?player=${encodeURIComponent(username)}`;

  try {
    const response = await fetchFn(url, {
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 404 || response.status === 400) return { status: 'notFound', httpStatus: response.status };
    if (!response.ok) return { status: 'failed', reason: `HTTP ${response.status}` };

    const json = (await response.json().catch(() => null)) as Partial<JagexHiscoreJson> | null;
    // Only the shape is checked: Jagex appends skills and activities over time, so an exact length would break scraping.
    if (!Array.isArray(json?.skills) || !Array.isArray(json?.activities))
      return { status: 'failed', reason: 'unexpected body' };

    let mapped: MappedHiscore;
    try {
      mapped = fromJagex(json as JagexHiscoreJson);
    } catch {
      return { status: 'failed', reason: 'unexpected body' }; // e.g. a `null` in an array
    }
    return {
      status: 'found',
      hiscore: { skills: mapped.skills, activities: mapped.activities },
      layout: mapped.layout,
    };
  } catch (error) {
    // Checked by name, not instanceof: the timeout's DOMException can come from another realm (e.g. node-fetch, Jest).
    const { name, message } = (error ?? {}) as { name?: unknown; message?: unknown };
    if (name === 'TimeoutError' || name === 'AbortError')
      return { status: 'failed', reason: `timed out after ${timeoutMs}ms` };
    return { status: 'failed', reason: `network error: ${typeof message === 'string' ? message : String(error)}` };
  }
}
