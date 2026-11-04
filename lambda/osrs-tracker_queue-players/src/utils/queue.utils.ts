import { PlayerScrapeMessageBody, PlayerSubscription } from '@osrs-tracker/models';

/** The scraping offset to queue at `date`'s UTC hour, -12 to 11: hours 0 to 11 queue 0 to 11, hours 12 to 23 -12 to -1. */
export function scrapingOffsetForHour(date: Date): number {
  return ((12 + date.getUTCHours()) % 24) - 12;
}

/** The players subscribed to `scrapingOffset`. At -12 that includes offset 12, the same time. */
export function subscriptionsForOffset(
  subscriptions: PlayerSubscription[],
  scrapingOffset: number,
): PlayerSubscription[] {
  return subscriptions.filter(
    ({ scrapingOffsets }) => scrapingOffsets.has(scrapingOffset) || (scrapingOffset === -12 && scrapingOffsets.has(12)),
  );
}

/**
 * process-players' events for `subscriptions`, `size` usernames each. An event holds one hiscore table's players, since
 * process-players fetches one table per event; `table` is left out for the main table, as in the subscription.
 */
export function scrapeEvents(
  subscriptions: PlayerSubscription[],
  scrapingOffset: number,
  size: number,
): PlayerScrapeMessageBody[] {
  return [...Map.groupBy(subscriptions, ({ table }) => table)].flatMap(([table, players]) =>
    chunks(
      players.map(({ username }) => username),
      size,
    ).map((usernames) => ({ usernames, scrapingOffset, ...(table && { table }) })),
  );
}

/** Splits `items` into arrays of `size` items, the last one shorter. Node has no array chunking built in yet. */
export function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}
