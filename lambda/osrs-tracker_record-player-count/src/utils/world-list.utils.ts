import { PlayerCount } from '@osrs-tracker/models';
import { USER_AGENT } from '@lambda/shared/user-agent';

/**
 * Jagex's world list, as used by the client and the World Select page. Undocumented; checked on 2026-10-13. Don't
 * scrape the homepage's "people playing" instead, and don't poll this faster than once a minute.
 */
export const WORLD_LIST_URL = 'https://www.runescape.com/g=oldscape/slr.ws?order=LPWM';

/** A world's type flag for a members world; any other world is free-to-play. */
const MEMBERS_FLAG = 0x1;

export async function fetchWorldList(): Promise<Uint8Array> {
  const response = await fetch(WORLD_LIST_URL, {
    headers: {
      'cache-control': 'no-cache',
      'user-agent': USER_AGENT,
    },
    // undici's own timeouts are 300 s; fail a stalled request well within the Lambda's 30 s timeout
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`World list request failed: HTTP ${response.status}`);

  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Sums the players in a world list response. The format is big-endian:
 *
 * ```
 * int32   payload size (the bytes after this field; the response is padded with zeros to 30,000 bytes)
 * uint16  world count
 * per world:
 *   uint16  world id
 *   int32   type flags (0x1 = members)
 *   cstring address   (null-terminated)
 *   cstring activity  (null-terminated)
 *   uint8   location
 *   int16   players   (-1 = offline, counted as 0)
 * ```
 *
 * Throws when the worlds don't end exactly at the payload's end, so a change to the format fails instead of being
 * miscounted.
 */
export function parseWorldList(bytes: Uint8Array): Omit<PlayerCount, 'date'> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.byteLength < 6) throw new Error(`World list too short: ${bytes.byteLength} bytes`);
  const end = view.getInt32(0) + 4;
  if (end < 6 || end > bytes.byteLength)
    throw new Error(`World list payload size ${end - 4} doesn't fit the ${bytes.byteLength}-byte response`);

  const worlds = view.getUint16(4);
  let offset = 6;

  /** Moves `offset` past `length` bytes, throwing when they run past the payload. */
  const take = (length: number): number => {
    if (offset + length > end) throw new Error(`World list ends early, at byte ${offset} of ${end}`);
    const start = offset;
    offset += length;
    return start;
  };
  const skipString = () => {
    const nul = bytes.indexOf(0, offset);
    if (nul === -1 || nul >= end) throw new Error(`World list string at byte ${offset} isn't terminated`);
    offset = nul + 1;
  };

  let members = 0;
  let f2p = 0;
  const byLocation: Record<string, number> = {};

  for (let i = 0; i < worlds; i++) {
    const flags = view.getInt32(take(6) + 2);
    skipString(); // address
    skipString(); // activity
    const location = view.getUint8(take(1));
    const players = Math.max(0, view.getInt16(take(2)));

    if (flags & MEMBERS_FLAG) members += players;
    else f2p += players;
    byLocation[location] = (byLocation[location] ?? 0) + players;
  }

  if (offset !== end) throw new Error(`World list has ${end - offset} bytes left after ${worlds} worlds`);

  return { total: members + f2p, members, f2p, worlds, byLocation };
}
