import { SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs';
import { Player, PlayerScrapeMessageBody } from '@osrs-tracker/models';
import { Context, SQSEvent } from 'aws-lambda';
import { AnyBulkWriteOperation, ServerApiVersion } from 'mongodb';
import { chunk } from './utils/array.utils';
import { discordAlert } from './utils/discord-alert';
import { mapArrayPush } from './utils/map.utils';
import { MU } from './utils/mongo.utils';
import { fetchHiscore } from './utils/player.utils';
import { createMessage, sendMessageBatch } from './utils/sqs.utils';
import { env } from './env';

const SQS_MESSAGE_BATCH_SIZE = 10; // max 10

const sqsClient = new SQSClient({ region: 'eu-central-1' });

const client = MU.client({ serverApi: { version: ServerApiVersion.v1, deprecationErrors: true } });

export const handler = async (event: SQSEvent, context: Context) => {
  // Parse message bodies
  const messageBodies: PlayerScrapeMessageBody[] = event.Records.map((record) => JSON.parse(record.body));

  // Logs max SQS retry count (ApproximateReceiveCount) so we can see how many times the messages were delivered.
  const maxReceiveCount = event.Records.reduce(
    (acc, val) => Math.max(acc, parseInt(val.attributes.ApproximateReceiveCount)),
    0,
  );

  if (messageBodies.length === 0) {
    console.log('No messages to process');
    return context.logStreamName;
  }

  // map of failed (retryable) usernames by scrapingOffset
  const failedMap: Map<number, string[]> = new Map();

  // usernames that are not on the hiscores (404), these are skipped without retry
  const notFoundUsernames: string[] = [];

  // usernames whose scraping got paused in this run (not on the hiscores for 7 days in a row)
  const pausedUsernames: string[] = [];

  // bulk writes, one per message, with the usernames each one stores a hiscore entry for. Each write is settled as soon
  // as it's started: it's only awaited after the later messages are scraped, and a rejection left unhandled until then
  // would crash the invocation (and SQS would retry it, storing duplicates)
  const bulkWrites: { usernames: string[]; result: Promise<PromiseSettledResult<number>> }[] = [];

  // scrape each message body sequentially
  for (const messageBody of messageBodies) {
    const { usernames, scrapingOffset } = messageBody;
    const scrapeTime = new Date();
    const bulkUpdateOps: AnyBulkWriteOperation<Player>[] = [];
    const bulkUpdateUsernames: string[] = [];

    // scrape each username from body with staggered delays and wait for all to finish
    await Promise.allSettled(
      usernames.map(async (username, index) => {
        // Add 2000ms (2 second) delay for each subsequent request to avoid 503 errors
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, index * 2000));

        const result = await fetchHiscore(username);
        if (result.status === 'notFound') {
          notFoundUsernames.push(username);
          if (await MU.recordHiscoreNotFound(client, username)) pausedUsernames.push(username);
          return;
        }
        if (result.status === 'failed') return mapArrayPush(failedMap, scrapingOffset, username);

        const hiscoreJson = result.hiscore;

        // add hiscoreEntry to player.hiscoreEntries via bulkWriteOp
        bulkUpdateUsernames.push(username);
        bulkUpdateOps.push(
          MU.hiscoreEntryBulkWriteOp(username, {
            date: scrapeTime,
            scrapingOffset,
            skills: hiscoreJson.skills,
            activities: hiscoreJson.activities,
          }),
        );
      }),
    );

    // Only bulk update if there are any updates, can be empty if all usernames failed
    if (bulkUpdateOps.length)
      bulkWrites.push({
        usernames: bulkUpdateUsernames,
        result: Promise.allSettled([MU.bulkWrite(client, bulkUpdateOps)]).then(([result]) => result),
      });
  }

  // wait for all bulk writes to finish. A failed write must not throw (an SQS retry would store duplicates for the
  // other writes, or for the part of its own entries it stored before failing), so its players aren't retried either;
  // they're alerted on below
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
  const failedMessagesCount = [...failedMap.values()].flat().length;
  const attemptedPlayerCount =
    messageBodies.reduce((acc, body) => acc + body.usernames.length, 0) - notFoundUsernames.length;

  if (notFoundUsernames.length)
    console.log(`Skipped ${notFoundUsernames.length} players not on the hiscores:`, notFoundUsernames);

  // throw error if no write was attempted because every scrape failed, so SQS retries the whole message. Nothing was
  // stored, so that's safe. Dont send new SQS messages or we will get stuck in a loop (a message where every player is
  // not on the hiscores completes normally, there's nothing to retry)
  if (attemptedPlayerCount > 0 && bulkWrites.length === 0) {
    if (maxReceiveCount > 1) await discordAlert('No players were updated', [...failedMap.values()].flat(), context);

    throw new Error(`No players were updated. Failed to update ${failedMessagesCount} players.`);
  }

  // usernames whose retry message SQS rejected (or whose batch failed to send), so their retry is lost
  const unqueuedUsernames: string[] = [];

  // If some usernames updated successfully and some failed, send new SQS messages for the failed usernames
  if (failedMap.size > 0) {
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

    // send failed messages in batches. Never throw here: the bulk writes are done, so an SQS retry of this message
    // would store duplicate hiscore entries. A batch that fails to send counts as rejected as a whole.
    const rejectedIds = await Promise.all(
      chunk(failedMessages, SQS_MESSAGE_BATCH_SIZE).map((messageBatch) =>
        sendMessageBatch(sqsClient, messageBatch).then(
          (failed) => failed.map(({ Id }) => Id),
          (e) => {
            console.error('Failed to send SQS message batch', e);
            return messageBatch.map(({ Id }) => Id);
          },
        ),
      ),
    );
    rejectedIds.flat().forEach((id) => unqueuedUsernames.push(...(usernamesByMessageId.get(id!) ?? [])));
  }

  console.log(
    `Updated ${updatedPlayerCount} players successfully.`,
    `Failed to update ${failedMessagesCount} players.`,
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

  if (failedMessagesCount && maxReceiveCount > 1) {
    await discordAlert('Failed to process some players', [...failedMap.values()].flat(), context);
  }

  return context.logStreamName;
};
