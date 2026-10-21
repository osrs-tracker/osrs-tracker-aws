import { describe, expect, it } from 'vitest';
import { chunks, scrapingOffsetForHour } from './queue.utils';

describe('scrapingOffsetForHour', () => {
  it.each([
    ['00:00', 0],
    ['11:59', 11],
    ['12:00', -12],
    ['23:00', -1],
  ])('maps %s UTC to offset %i', (time, offset) => {
    expect(scrapingOffsetForHour(new Date(`2026-10-02T${time}:00Z`))).toBe(offset);
  });
});

describe('chunks', () => {
  const size = 3;

  const names = (count: number, from = 1) => Array.from({ length: count }, (_, i) => `player ${from + i}`);

  async function* source(usernames: string[], read = { count: 0 }) {
    for (const username of usernames) {
      read.count++;
      yield username;
    }
  }

  // Array.fromAsync is ES2024, past the Lambdas' `lib`
  async function chunksFor(count: number) {
    const result: string[][] = [];
    for await (const chunk of chunks(source(names(count)), size)) result.push(chunk);
    return result;
  }

  it('yields nothing without usernames', async () => {
    expect(await chunksFor(0)).toEqual([]);
  });

  it('yields a single username in a partial chunk', async () => {
    expect(await chunksFor(1)).toEqual([['player 1']]);
  });

  it('fills exactly one chunk', async () => {
    expect(await chunksFor(size)).toEqual([names(size)]);
  });

  it('starts a new chunk once one is full and yields the last partial one', async () => {
    const count = 2 * size + 1;

    expect(await chunksFor(count)).toEqual([names(size), names(size, size + 1), [`player ${count}`]]);
  });

  it('yields a full chunk before reading the next username', async () => {
    const read = { count: 0 };
    const result = chunks(source(names(100), read), size);

    await result.next();

    expect(read.count).toBe(size);
  });
});
