import { LambdaClient } from '@aws-sdk/client-lambda';
import { Context } from 'aws-lambda';
import { invokeAsync } from '@lambda/shared/lambda.utils';
import { env } from '../env';
import { chunk } from './array.utils';
import { discordAlert } from './discord-alert';
import { ScrapeEvent } from './scrape-message';

/** How many times players that keep failing are requeued; after that they're alerted on instead. */
export const MAX_RETRIES = 3;

/** A started bulk write, settled at once (see the handler), with the usernames it stores a hiscore entry for. */
export interface BulkWrite {
  usernames: string[];
  result: Promise<PromiseSettledResult<number>>;
}

/** What the handler's scrape of the event left to finish. */
export interface ScrapeRun {
  /** the event scraped: the requeue keeps its offset and counts its retry */
  event: ScrapeEvent;
  /** the found players' entries; none when no player was found */
  bulkWrite?: BulkWrite;
  /** failed (retryable) usernames */
  failedUsernames: string[];
  notFoundUsernames: string[];
  pausedUsernames: string[];
}

/**
 * Finishes a run once its bulk write has started: waits for it, requeues the failed players in new events (up to
 * `MAX_RETRIES` times) and sends the alerts. Never rejects, since a Lambda retry would store duplicate hiscore entries:
 * every step it takes settles its own failures (the bulk write is settled when started, `invokeAsync` and
 * `discordAlert` never reject). A failed write's players aren't retried for the same reason; they're alerted on.
 */
export async function afterWrites(lambdaClient: LambdaClient, run: ScrapeRun, context: Context): Promise<void> {
  const { event, failedUsernames, notFoundUsernames, pausedUsernames } = run;
  const { updatedPlayerCount, unwrittenUsernames } = await settleBulkWrite(run.bulkWrite);
  const retry = event.retry ?? 0;
  const givingUp = retry >= MAX_RETRIES;

  if (notFoundUsernames.length)
    console.log(`Skipped ${notFoundUsernames.length} players not on the hiscores:`, notFoundUsernames);

  const unqueuedUsernames = givingUp
    ? []
    : await requeue(lambdaClient, context.functionName, {
        usernames: failedUsernames,
        scrapingOffset: event.scrapingOffset,
        retry: retry + 1,
      });

  console.log(
    `Updated ${updatedPlayerCount} players successfully.`,
    `Failed to update ${failedUsernames.length} players.`,
    `Skipped ${notFoundUsernames.length} players not on the hiscores.`,
  );

  if (unwrittenUsernames.length) {
    console.error(`Failed to store hiscore entries for ${unwrittenUsernames.length} players:`, unwrittenUsernames);
    await discordAlert('Failed to store hiscores', unwrittenUsernames, context, 'Failed to store a hiscore entry for');
  }

  if (unqueuedUsernames.length) {
    console.error(`Failed to queue a retry for ${unqueuedUsernames.length} players:`, unqueuedUsernames);
    await discordAlert('Failed to queue retries', unqueuedUsernames, context, 'Failed to queue a retry for');
  }

  if (givingUp && failedUsernames.length) {
    console.error(`Gave up on ${failedUsernames.length} players after ${retry + 1} failed attempts:`, failedUsernames);
    await discordAlert('Gave up retrying', failedUsernames, context, `Failed ${retry + 1} times in a row, gave up on`);
  }

  if (pausedUsernames.length) {
    console.log(
      `Paused scraping for ${pausedUsernames.length} players not on the hiscores for 7 days:`,
      pausedUsernames,
    );
    await discordAlert(
      'Paused scraping',
      pausedUsernames,
      context,
      'Not on the hiscores for 7 days, paused scraping for',
    );
  }
}

/** Waits for the bulk write; when it failed, it's logged and its usernames returned as unwritten. */
async function settleBulkWrite(bulkWrite?: BulkWrite) {
  if (!bulkWrite) return { updatedPlayerCount: 0, unwrittenUsernames: [] };

  const result = await bulkWrite.result;
  if (result.status === 'fulfilled') return { updatedPlayerCount: result.value, unwrittenUsernames: [] };

  console.error('Bulk write failed', result.reason);
  return { updatedPlayerCount: 0, unwrittenUsernames: bulkWrite.usernames };
}

/**
 * Invokes this function (`functionName`) again, asynchronously, with `failed`'s usernames split into events of
 * `PLAYERS_PER_EVENT` (each with its offset and retry count), and returns the usernames whose event Lambda didn't
 * accept, so their retry is lost.
 */
async function requeue(lambdaClient: LambdaClient, functionName: string, failed: ScrapeEvent): Promise<string[]> {
  const events: ScrapeEvent[] = chunk(failed.usernames, env.PLAYERS_PER_EVENT).map((usernames) => ({
    ...failed,
    usernames,
  }));

  const accepted = await Promise.all(events.map((retryEvent) => invokeAsync(lambdaClient, functionName, retryEvent)));
  return events.flatMap((retryEvent, i) => (accepted[i] ? [] : retryEvent.usernames));
}
