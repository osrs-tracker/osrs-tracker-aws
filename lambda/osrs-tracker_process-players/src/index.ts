import { SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs';
import { Player, PlayerScrapeMessageBody } from '@osrs-tracker/models';
import { Context, SQSEvent } from 'aws-lambda';
import { Agent } from 'https';
import chunk from 'lodash.chunk';
import { AnyBulkWriteOperation, ServerApiVersion } from 'mongodb';
import { discordAlert } from './utils/discord-alert';
import { mapArrayPush } from './utils/map.utils';
import { MU } from './utils/mongo.utils';
import { getHiscore, hiscoreJsonToSourceString } from './utils/player.utils';
import { createMessage, sendMessageBatch } from './utils/sqs.utils';

const SQS_MESSAGE_BATCH_SIZE = 10; // max 10

const sqsClient = new SQSClient({ region: 'eu-central-1' });

const client = MU.client({ serverApi: { version: ServerApiVersion.v1, deprecationErrors: true } });

const agent = new Agent({
  keepAlive: true,
  maxFreeSockets: 10,
  maxSockets: 50,
  timeout: 30000,
});

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

  // array of promises for bulk writes
  const bulkWrites: Promise<number>[] = [];

  // ensure index is created
  await MU.ensureIndex(client, { username: 1 }, { unique: true });

  // scrape each message body sequentially
  for (const messageBody of messageBodies) {
    const { usernames, scrapingOffset } = messageBody;
    const scrapeTime = new Date();
    const bulkUpdateOps: AnyBulkWriteOperation<Player>[] = [];

    // scrape each username from body with staggered delays and wait for all to finish
    await Promise.allSettled(
      usernames.map(async (username, index) => {
        // Add 2000ms (2 second) delay for each subsequent request to avoid 503 errors
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, index * 2000));

        const result = await getHiscore(agent, username);
        if (result.status === 'notFound') return notFoundUsernames.push(username);
        if (result.status === 'failed') return mapArrayPush(failedMap, scrapingOffset, username);

        const hiscoreJson = result.hiscore;

        // add hiscoreEntry to player.hiscoreEntries via bulkWriteOp
        bulkUpdateOps.push(
          MU.hiscoreEntryBulkWriteOp(username, {
            sourceString: hiscoreJsonToSourceString(hiscoreJson),
            date: scrapeTime,
            scrapingOffset,
            skills: hiscoreJson.skills,
            activities: hiscoreJson.activities,
          }),
        );
      }),
    );

    // Only bulk update if there are any updates, can be empty if all usernames failed
    if (bulkUpdateOps.length) bulkWrites.push(MU.bulkWrite(client, bulkUpdateOps));
  }

  // wait for all bulk writes to finish
  const modifiedCounts = await Promise.all(bulkWrites);
  const updatedPlayerCount = modifiedCounts.reduce((acc, count) => acc + count, 0);
  const failedMessagesCount = [...failedMap.values()].flat().length;
  const attemptedPlayerCount =
    messageBodies.reduce((acc, body) => acc + body.usernames.length, 0) - notFoundUsernames.length;

  if (notFoundUsernames.length)
    console.log(`Skipped ${notFoundUsernames.length} players not on the hiscores:`, notFoundUsernames);

  // throw error if no players were updated. Dont send new SQS messages or we will get stuck in a loop
  // (a message where every player is not on the hiscores completes normally, there's nothing to retry)
  if (attemptedPlayerCount > 0 && updatedPlayerCount === 0) {
    if (maxReceiveCount > 1) await discordAlert('No players were updated', [...failedMap.values()].flat(), context);

    throw new Error(`No players were updated. Failed to update ${failedMessagesCount} players.`);
  }

  // If some usernames updated successfully and some failed, send new SQS messages for the failed usernames
  if (failedMap.size > 0) {
    const failedMessages: SendMessageBatchRequestEntry[] = [];

    // create messages from failed usernames
    failedMap.forEach((usernames, scrapingOffset) =>
      failedMessages.push(
        ...chunk(usernames, parseInt(process.env.PLAYERS_PER_SQS_MESSAGE!)).map((usernameBatch) =>
          createMessage(usernameBatch, scrapingOffset),
        ),
      ),
    );

    // send failed messages in batches
    await Promise.all(
      chunk(failedMessages, SQS_MESSAGE_BATCH_SIZE).map((messageBatch) => sendMessageBatch(sqsClient, messageBatch)),
    );
  }

  console.log(
    `Updated ${updatedPlayerCount} players successfully.`,
    `Failed to update ${failedMessagesCount} players.`,
    `Skipped ${notFoundUsernames.length} players not on the hiscores.`,
  );

  if (failedMessagesCount && maxReceiveCount > 1) {
    await discordAlert('Failed to process some players', [...failedMap.values()].flat(), context);
  }

  return context.logStreamName;
};
