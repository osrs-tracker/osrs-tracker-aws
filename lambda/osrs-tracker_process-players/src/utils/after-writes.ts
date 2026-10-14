import { SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs';
import { Context } from 'aws-lambda';
import { createMessage, sendMessageBatch, SQS_MESSAGE_BATCH_SIZE } from '@lambda/shared/sqs.utils';
import { env } from '../env';
import { chunk } from './array.utils';
import { discordAlert } from './discord-alert';

/** A started bulk write, settled at once (see the handler), with the usernames it stores a hiscore entry for. */
export interface BulkWrite {
  usernames: string[];
  result: Promise<PromiseSettledResult<number>>;
}

/** What the handler's scrape of all messages left to finish. */
export interface ScrapeRun {
  /** one per message with players found */
  bulkWrites: BulkWrite[];
  /** failed (retryable) usernames by scrapingOffset */
  failedMap: Map<number, string[]>;
  notFoundUsernames: string[];
  pausedUsernames: string[];
  /** the highest SQS `ApproximateReceiveCount` of the messages: above 1, a message is redelivered */
  maxReceiveCount: number;
}

/**
 * Finishes a run once its bulk writes have started: waits for them, requeues the failed players in new messages and
 * sends the alerts. Never rejects, since an SQS retry would store duplicate hiscore entries: every step it takes
 * settles its own failures (the bulk writes are settled when started, `sendMessageBatch` and `discordAlert` never
 * reject). A failed write's players aren't retried for the same reason; they're alerted on.
 */
export async function afterWrites(sqsClient: SQSClient, run: ScrapeRun, context: Context): Promise<void> {
  const { failedMap, notFoundUsernames, pausedUsernames, maxReceiveCount } = run;
  const { updatedPlayerCount, unwrittenUsernames } = await settleBulkWrites(run.bulkWrites);
  const failedUsernames = [...failedMap.values()].flat();

  if (notFoundUsernames.length)
    console.log(`Skipped ${notFoundUsernames.length} players not on the hiscores:`, notFoundUsernames);

  const unqueuedUsernames = await requeue(sqsClient, failedMap);

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

  if (failedUsernames.length && maxReceiveCount > 1) {
    await discordAlert('Failed to process some players', failedUsernames, context);
  }
}

/** Waits for the bulk writes; a failed one is logged and its usernames returned as unwritten. */
async function settleBulkWrites(bulkWrites: BulkWrite[]) {
  const writeResults = await Promise.all(bulkWrites.map(({ result }) => result));
  let updatedPlayerCount = 0;
  const unwrittenUsernames: string[] = [];
  writeResults.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      updatedPlayerCount += result.value;
    } else {
      console.error('Bulk write failed', result.reason);
      unwrittenUsernames.push(...bulkWrites[i].usernames);
    }
  });
  return { updatedPlayerCount, unwrittenUsernames };
}

/**
 * Sends new SQS messages for the failed usernames, per scrapingOffset, and returns the usernames whose retry message
 * SQS rejected (or whose batch failed to send), so their retry is lost.
 */
async function requeue(sqsClient: SQSClient, failedMap: Map<number, string[]>): Promise<string[]> {
  const failedMessages: SendMessageBatchRequestEntry[] = [];
  const usernamesByMessageId: Map<string, string[]> = new Map();

  // create messages from failed usernames
  failedMap.forEach((usernames, scrapingOffset) =>
    chunk(usernames, env.PLAYERS_PER_SQS_MESSAGE).forEach((usernameBatch) => {
      const message = createMessage(usernameBatch, scrapingOffset);
      usernamesByMessageId.set(message.Id, usernameBatch);
      failedMessages.push(message);
    }),
  );

  // send failed messages in batches. `sendMessageBatch` never rejects; a batch that fails to send counts as rejected as
  // a whole
  const rejected = await Promise.all(
    chunk(failedMessages, SQS_MESSAGE_BATCH_SIZE).map((messageBatch) =>
      sendMessageBatch(sqsClient, env.SQS_QUEUE_URL, messageBatch),
    ),
  );
  return rejected.flat().flatMap(({ Id }) => usernamesByMessageId.get(Id!) ?? []);
}
