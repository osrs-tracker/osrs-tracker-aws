import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, jest } from '@jest/globals';
import { fetchWorldList, parseWorldList, WORLD_LIST_URL, WorldListFetch } from './world-list-client';

/** The world list response on 2026-10-13 12:55 UTC: 30,000 bytes, of which 14,617 payload. */
const captured = new Uint8Array(readFileSync(join(__dirname, '../fixtures/world-list-2026-10-13.bin')));

interface World {
  flags: number;
  location: number;
  players: number;
}

/** Builds a world list response in Jagex's format, padded with `padding` zero bytes. */
function worldList(worlds: World[], padding = 0): Uint8Array {
  const parts = worlds.map(({ flags, location, players }, i) => {
    const address = Buffer.from(`oldschool${i}.runescape.com\0activity\0`, 'latin1');
    const world = Buffer.alloc(6 + address.length + 3);
    world.writeUInt16BE(300 + i, 0);
    world.writeInt32BE(flags, 2);
    address.copy(world, 6);
    world.writeUInt8(location, 6 + address.length);
    world.writeInt16BE(players, 7 + address.length);
    return world;
  });
  const payload = Buffer.concat([Buffer.alloc(2), ...parts]);
  payload.writeUInt16BE(worlds.length, 0);
  const size = Buffer.alloc(4);
  size.writeInt32BE(payload.length, 0);
  return new Uint8Array(Buffer.concat([size, payload, Buffer.alloc(padding)]));
}

describe('parseWorldList', () => {
  it('sums a captured response', () => {
    // matches an independent parse; the homepage said 84,056 people playing moments later
    expect(parseWorldList(captured)).toEqual({
      total: 83817,
      members: 76766,
      f2p: 7051,
      worlds: 321,
      byLocation: { 0: 35100, 1: 20365, 3: 6089, 7: 18657, 8: 1078, 9: 595, 10: 1700, 12: 233 },
    });
  });

  it('counts an offline world (-1 players) as 0, and splits members and F2P by the members flag', () => {
    const bytes = worldList(
      [
        { flags: 0x1, location: 0, players: 1200 },
        { flags: 0x2000001, location: 1, players: -1 },
        { flags: 0x0, location: 0, players: 300 },
      ],
      100,
    );

    expect(parseWorldList(bytes)).toEqual({
      total: 1500,
      members: 1200,
      f2p: 300,
      worlds: 3,
      byLocation: { 0: 1500, 1: 0 },
    });
  });

  it('parses a list with no worlds, which the handler then rejects', () => {
    expect(parseWorldList(worldList([]))).toEqual({ total: 0, members: 0, f2p: 0, worlds: 0, byLocation: {} });
  });

  it('throws when the payload size is larger than the response', () => {
    expect(() => parseWorldList(captured.slice(0, 14_000))).toThrow("doesn't fit");
  });

  it('throws when the response is too short for a header', () => {
    expect(() => parseWorldList(new Uint8Array(3))).toThrow('too short');
  });

  it('throws when the worlds run past the payload', () => {
    const bytes = worldList([{ flags: 1, location: 0, players: 10 }]);
    new DataView(bytes.buffer).setUint16(4, 2); // claims 2 worlds

    expect(() => parseWorldList(bytes)).toThrow('ends early');
  });

  it('throws when bytes are left after the last world, e.g. a new field per world', () => {
    const bytes = worldList([{ flags: 1, location: 0, players: 10 }], 4);
    const view = new DataView(bytes.buffer);
    view.setInt32(0, view.getInt32(0) + 4); // the padding becomes payload

    expect(() => parseWorldList(bytes)).toThrow('4 bytes left');
  });

  it('throws on a string without a terminator inside the payload', () => {
    // all-zero padding would end the string, so the payload ends right after it and the rest is cut off
    const bytes = worldList([{ flags: 1, location: 0, players: 10 }]).slice(0, 20);
    new DataView(bytes.buffer).setInt32(0, 16);

    expect(() => parseWorldList(bytes)).toThrow("isn't terminated");
  });
});

describe('fetchWorldList', () => {
  function respond(status: number, body = captured) {
    return jest.fn<WorldListFetch>(async () => ({
      status,
      ok: status >= 200 && status < 300,
      arrayBuffer: async () => body.slice().buffer,
    }));
  }

  it('returns the response bytes, which parse', async () => {
    const bytes = await fetchWorldList({ fetch: respond(200) });
    expect(parseWorldList(bytes).worlds).toBe(321);
  });

  it('requests the world list with no-cache and a timeout signal, and no user-agent by default', async () => {
    const fetch = respond(200);
    await fetchWorldList({ fetch });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(WORLD_LIST_URL);
    expect(init.headers).toEqual({ 'cache-control': 'no-cache' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('sends the given user-agent', async () => {
    const fetch = respond(200);
    await fetchWorldList({ fetch, userAgent: 'github:example' });
    expect(fetch.mock.calls[0][1].headers).toEqual({ 'cache-control': 'no-cache', 'user-agent': 'github:example' });
  });

  it('throws on a non-2xx response', async () => {
    await expect(fetchWorldList({ fetch: respond(503) })).rejects.toThrow('HTTP 503');
  });
});
