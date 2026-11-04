import { PlayerSubscription } from '@osrs-tracker/models';
import { describe, expect, it } from 'vitest';
import { chunks, scrapeEvents, scrapingOffsetForHour, subscriptionsForOffset } from './queue.utils';

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

describe('subscriptionsForOffset', () => {
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
  const usernames = (offset: number) => subscriptionsForOffset(subscriptions, offset).map(({ username }) => username);

  it('keeps the players subscribed to the offset', () => {
    expect(usernames(3)).toEqual(['alice', 'bob']);
  });

  it('includes offset 12 at -12', () => {
    expect(usernames(-12)).toEqual(['bob', 'carol']);
  });

  it('returns nothing when no player has the offset', () => {
    expect(usernames(5)).toEqual([]);
  });
});

describe('scrapeEvents', () => {
  const main = (username: string): PlayerSubscription => ({ username, scrapingOffsets: new Set([3]) });
  const hardcore = (username: string): PlayerSubscription => ({
    ...main(username),
    table: 'hiscore_oldschool_hardcore_mains',
  });

  it('yields nothing without subscriptions', () => {
    expect(scrapeEvents([], 3, 2)).toEqual([]);
  });

  it('leaves the table out for main-table players', () => {
    expect(scrapeEvents([main('alice'), main('bob'), main('carol')], 3, 2)).toEqual([
      { usernames: ['alice', 'bob'], scrapingOffset: 3 },
      { usernames: ['carol'], scrapingOffset: 3 },
    ]);
  });

  it('chunks each table into its own events, never mixing them', () => {
    const subscriptions = [main('alice'), hardcore('bob'), main('carol'), hardcore('dave'), hardcore('erin')];

    expect(scrapeEvents(subscriptions, 3, 2)).toEqual([
      { usernames: ['alice', 'carol'], scrapingOffset: 3 },
      { usernames: ['bob', 'dave'], scrapingOffset: 3, table: 'hiscore_oldschool_hardcore_mains' },
      { usernames: ['erin'], scrapingOffset: 3, table: 'hiscore_oldschool_hardcore_mains' },
    ]);
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
