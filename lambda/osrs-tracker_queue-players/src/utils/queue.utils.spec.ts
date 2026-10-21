import { PlayerSubscription } from '@osrs-tracker/models';
import { describe, expect, it } from 'vitest';
import { chunks, scrapingOffsetForHour, usernamesForOffset } from './queue.utils';

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

describe('usernamesForOffset', () => {
  const subscription = (username: string, ...offsets: number[]): PlayerSubscription => ({
    username,
    scrapingOffsets: new Set(offsets),
  });
  const subscriptions = [
    subscription('alice', 3),
    subscription('bob', -12, 3),
    subscription('carol', 12),
    subscription('dave', -1),
  ];

  it('keeps the players subscribed to the offset', () => {
    expect(usernamesForOffset(subscriptions, 3)).toEqual(['alice', 'bob']);
  });

  it('includes offset 12 at -12', () => {
    expect(usernamesForOffset(subscriptions, -12)).toEqual(['bob', 'carol']);
  });

  it('returns nothing when no player has the offset', () => {
    expect(usernamesForOffset(subscriptions, 5)).toEqual([]);
  });
});

describe('chunks', () => {
  const size = 3;

  const names = (count: number, from = 1) => Array.from({ length: count }, (_, i) => `player ${from + i}`);

  it('yields nothing without usernames', () => {
    expect(chunks(names(0), size)).toEqual([]);
  });

  it('yields a single username in a partial chunk', () => {
    expect(chunks(names(1), size)).toEqual([['player 1']]);
  });

  it('fills exactly one chunk', () => {
    expect(chunks(names(size), size)).toEqual([names(size)]);
  });

  it('starts a new chunk once one is full and yields the last partial one', () => {
    const count = 2 * size + 1;

    expect(chunks(names(count), size)).toEqual([names(size), names(size, size + 1), [`player ${count}`]]);
  });
});
