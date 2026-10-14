import {
  createHiscoreLayout,
  encodeHiscoreEntry,
  HiscoreLayout,
  PlayerScrapeMessageBody,
  StoredPlayer,
} from '@osrs-tracker/models';
import { AnyBulkWriteOperation, MongoClient } from 'mongodb';
import { setTimeout as sleep } from 'node:timers/promises';
import { MU } from './mongo.utils';
import { fetchHiscore } from './player.utils';

/** What {@link scrapeMessage} found for one message's players. */
export interface ScrapedMessage {
  /** one op per player found, adding its hiscore entry; the layouts the entries use are stored */
  bulkUpdateOps: AnyBulkWriteOperation<StoredPlayer>[];
  /** the usernames `bulkUpdateOps` store an entry for */
  bulkUpdateUsernames: string[];
  /** usernames to retry: the request failed, the scrape threw or the layouts failed to store */
  failedUsernames: string[];
  /** usernames that are not on the hiscores (404), these are skipped without retry */
  notFoundUsernames: string[];
  /** usernames whose scraping got paused in this run (not on the hiscores for 7 days in a row) */
  pausedUsernames: string[];
}

/**
 * Scrapes a message's players with staggered requests, records the ones not on the hiscores, and builds the bulk write
 * ops for the ones found, once the layouts their entries use are stored. Never rejects: an earlier message's bulk write
 * may already be running, so a failure only moves the players it concerns to `failedUsernames`.
 */
export async function scrapeMessage(
  client: MongoClient,
  { usernames, scrapingOffset }: PlayerScrapeMessageBody,
): Promise<ScrapedMessage> {
  const scrapeTime = new Date();
  const scraped: ScrapedMessage = {
    bulkUpdateOps: [],
    bulkUpdateUsernames: [],
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
    return { ...scraped, bulkUpdateOps: [], bulkUpdateUsernames: [] };
  }

  return scraped;
}
