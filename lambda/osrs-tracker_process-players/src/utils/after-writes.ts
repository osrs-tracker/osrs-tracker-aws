import { LambdaClient } from '@aws-sdk/client-lambda';
import { SQSClient } from '@aws-sdk/client-sqs';
import type { Context } from 'aws-lambda';
import { invokeAsync } from '@lambda/shared/lambda.utils';
import { sendScrapeResult } from '@lambda/shared/sqs.utils';
import { env } from '../env';
import { chunk } from './array.utils';
import { discordAlert } from './discord-alert';
import { ScrapedMessage, ScrapeEvent } from './scrape-message';

/** How many times players that keep failing are requeued; after that they're alerted on instead. */
export const MAX_RETRIES = 3;

/** The AWS clients the handler creates at module scope. */
export interface AwsClients {
  lambda: LambdaClient;
  sqs: SQSClient;
}

/** What the handler's scrape of the event left to finish. */
export interface ScrapeRun extends ScrapedMessage {
  /** the event scraped: the requeue keeps its offset and counts its retry */
  event: ScrapeEvent;
}

/**
 * Finishes a run that found or recorded something: sends its results to the scrape results queue, then requeues the
 * failed players in new events (up to `MAX_RETRIES` times) and sends the alerts. Rejects only when the send fails, its
 * first step, so Lambda retries the event and scrapes it again (the ingester's slot guard drops an entry it already
 * stored). After the send it never rejects, since a retry would requeue the failed players a second time:
 * `invokeAsync` and `discordAlert` never reject.
 */
export async function afterWrites(clients: AwsClients, run: ScrapeRun, context: Context): Promise<void> {
  const { event, scrapedAt, found, failedUsernames, notFoundUsernames } = run;
  const retry = event.retry ?? 0;
  const givingUp = retry >= MAX_RETRIES;

  await sendScrapeResult(clients.sqs, env.SCRAPE_RESULTS_QUEUE_URL, {
    v: 1,
    type: 'hiscores',
    scrapedAt: scrapedAt.toISOString(),
    scrapingOffset: event.scrapingOffset,
    found,
    notFound: notFoundUsernames,
  });

  if (notFoundUsernames.length)
    console.log(`Skipped ${notFoundUsernames.length} players not on the hiscores:`, notFoundUsernames);

  const unqueuedUsernames = givingUp
    ? []
    : await requeue(clients.lambda, context.functionName, {
        usernames: failedUsernames,
        scrapingOffset: event.scrapingOffset,
        retry: retry + 1,
      });

  console.log(
    `Sent the hiscores of ${found.length} players to the scrape results queue.`,
    `Failed to update ${failedUsernames.length} players.`,
    `Skipped ${notFoundUsernames.length} players not on the hiscores.`,
  );

  if (unqueuedUsernames.length) {
    console.error(`Failed to queue a retry for ${unqueuedUsernames.length} players:`, unqueuedUsernames);
    await discordAlert('Failed to queue retries', unqueuedUsernames, context, 'Failed to queue a retry for');
  }

  if (givingUp && failedUsernames.length) {
    console.error(`Gave up on ${failedUsernames.length} players after ${retry + 1} failed attempts:`, failedUsernames);
    await discordAlert('Gave up retrying', failedUsernames, context, `Failed ${retry + 1} times in a row, gave up on`);
  }
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
