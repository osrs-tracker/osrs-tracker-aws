import {
  createHiscoreLayout,
  encodeHiscoreEntry,
  HiscoreLayout,
  PlayerScrapeMessageBody,
  ScrapedHiscore,
  StoredPlayer,
} from '@osrs-tracker/models';
import { AnyBulkWriteOperation, MongoClient } from 'mongodb';
import { setTimeout as sleep } from 'node:timers/promises';
import { MU } from './mongo.utils';
import { fetchHiscore } from './player.utils';

/**
 * process-players' event: one offset's players from queue-players, or the ones a run requeued. `retry` counts the
 * requeues; queue-players leaves it out.
 */
export interface ScrapeEvent extends PlayerScrapeMessageBody {
  retry?: number;
}

/** What {@link scrapeMessage} found for one event's players. */
export interface ScrapedMessage {
  /** when the scrape started: the date of every entry it builds */
  scrapedAt: Date;
  /** one op per player found, adding its hiscore entry; the layouts the entries use are stored */
  bulkUpdateOps: AnyBulkWriteOperation<StoredPlayer>[];
  /** the usernames `bulkUpdateOps` store an entry for */
  bulkUpdateUsernames: string[];
  /** the same players' hiscores as fetched, for the scrape results queue */
  found: ScrapedHiscore[];
  /** usernames to retry: the request failed, the scrape threw or the layouts failed to store */
  failedUsernames: string[];
  /** usernames that are not on the hiscores (404), these are skipped without retry */
  notFoundUsernames: string[];
  /** usernames whose scraping got paused in this run (not on the hiscores for 7 days in a row) */
  pausedUsernames: string[];
}

/**
 * Scrapes an event's players with staggered requests, records the ones not on the hiscores, and builds the bulk write
 * ops for the ones found, once the layouts their entries use are stored. Never rejects: a failure only moves the
 * players it concerns to `failedUsernames`, so the others are still written.
 */
export async function scrapeMessage(
  client: MongoClient,
  { usernames, scrapingOffset }: PlayerScrapeMessageBody,
): Promise<ScrapedMessage> {
  const scrapeTime = new Date();
  const scraped: ScrapedMessage = {
    scrapedAt: scrapeTime,
    bulkUpdateOps: [],
    bulkUpdateUsernames: [],
    found: [],
    failedUsernames: [],
    notFoundUsernames: [],
    pausedUsernames: [],
  };
  const layouts: HiscoreLayout[] = [];

  // scrape each username with staggered delays and wait for all to finish
  const scrapeResults = await Promise.allSettled(
    usernames.map(async (username, index) => {
      // Add 2000ms (2 second) delay for each subsequent request to avoid 503 errors
      if (index > 0) await sleep(index * 2000);

      const result = await fetchHiscore(username);
      if (result.status === 'notFound') {
        if (await MU.recordHiscoreNotFound(client, username)) scraped.pausedUsernames.push(username);
        scraped.notFoundUsernames.push(username);
        return;
      }
      if (result.status === 'failed') {
        scraped.failedUsernames.push(username);
        return;
      }

      const layout = createHiscoreLayout(result.layout, scrapeTime);
      const entry = encodeHiscoreEntry({ date: scrapeTime, scrapingOffset, ...result.hiscore }, layout);

      // add the entry to player.hiscoreEntries via bulkWriteOp, once its layout is stored
      layouts.push(layout);
      scraped.bulkUpdateUsernames.push(username);
      scraped.bulkUpdateOps.push(MU.hiscoreEntryBulkWriteOp(username, entry));
      scraped.found.push({ username, hiscore: result.hiscore, layout: result.layout });
    }),
  );

  // a scrape that threw (e.g. recording a 404 failed) is retried like a failed fetch, instead of silently dropped
  scrapeResults.forEach((result, i) => {
    if (result.status === 'fulfilled') return;
    console.error(`Failed to scrape username: ${usernames[i]}`, result.reason);
    scraped.failedUsernames.push(usernames[i]);
  });

  // Only store layouts if there are any updates, can be empty if all usernames failed
  if (!scraped.bulkUpdateOps.length) return scraped;

  // Store the layouts before the entries that use them. If that fails (e.g. Atlas is briefly unreachable, or a layout
  // id collision), nothing was written for these players yet, so they're retried like a failed fetch instead of
  // missing today's entry
  try {
    await MU.ensureHiscoreLayouts(client, layouts);
  } catch (error) {
    console.error('Failed to store hiscore layouts', error);
    scraped.failedUsernames.push(...scraped.bulkUpdateUsernames);
    return { ...scraped, bulkUpdateOps: [], bulkUpdateUsernames: [], found: [] };
  }

  return scraped;
}
