import { PlayerScrapeMessageBody, ScrapedHiscore } from '@osrs-tracker/models';
import { setTimeout as sleep } from 'node:timers/promises';
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
  /** when the scrape started: the date the ingester gives every entry of the event */
  scrapedAt: Date;
  /** the found players' hiscores as fetched, for the scrape results queue */
  found: ScrapedHiscore[];
  /** usernames to retry: the request failed or the scrape threw */
  failedUsernames: string[];
  /** usernames that are not on the hiscores (404), these are skipped without retry */
  notFoundUsernames: string[];
}

/**
 * Scrapes an event's players with staggered requests and sorts them into found, failed and not found. Never rejects: a
 * failure only moves the player it concerns to `failedUsernames`.
 */
export async function scrapeMessage({ usernames }: PlayerScrapeMessageBody): Promise<ScrapedMessage> {
  const scraped: ScrapedMessage = { scrapedAt: new Date(), found: [], failedUsernames: [], notFoundUsernames: [] };

  // scrape each username with staggered delays and wait for all to finish
  const scrapeResults = await Promise.allSettled(
    usernames.map(async (username, index) => {
      // Add 2000ms (2 second) delay for each subsequent request to avoid 503 errors
      if (index > 0) await sleep(index * 2000);

      const result = await fetchHiscore(username);
      if (result.status === 'notFound') scraped.notFoundUsernames.push(username);
      else if (result.status === 'failed') scraped.failedUsernames.push(username);
      else scraped.found.push({ username, hiscore: result.hiscore, layout: result.layout });
    }),
  );

  // a scrape that threw is retried like a failed fetch, instead of silently dropped
  scrapeResults.forEach((result, i) => {
    if (result.status === 'fulfilled') return;
    console.error(`Failed to scrape username: ${usernames[i]}`, result.reason);
    scraped.failedUsernames.push(usernames[i]);
  });

  return scraped;
}
