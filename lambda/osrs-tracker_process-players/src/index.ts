import { SendMessageBatchCommand, SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs';
import { Player, PlayerScrapeMessageBody } from '@osrs-tracker/models';
import { Context, SQSEvent } from 'aws-lambda';
import { Agent } from 'https';
import chunk from 'lodash.chunk';
import { AnyBulkWriteOperation, AuthMechanism, BulkWriteResult, MongoClient, ServerApiVersion } from 'mongodb';
import { discordAlert } from './utils/discord-alert';
import { mapArrayPush } from './utils/map.utils';
import { MU } from './utils/mongo.utils';
import { getHiscore } from './utils/player.utils';
import { createMessage } from './utils/sqs.utils';

const SQS_MESSAGE_BATCH_SIZE = 10; // max 10

const sqsClient = new SQSClient({ region: 'eu-central-1' });

const client = new MongoClient(process.env.MONGODB_URI!, {
  auth: {
    username: process.env.AWS_ACCESS_KEY_ID,
    password: process.env.AWS_SECRET_ACCESS_KEY,
  },
  serverApi: { version: ServerApiVersion.v1, deprecationErrors: true },
  authMechanism: AuthMechanism.MONGODB_AWS,
  authSource: '$external',
});

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

  // map of failed usernames by scrapingOffset
  const failedMap: Map<number, string[]> = new Map();

  // array of promises for bulk writes
  const bulkWrites: Promise<BulkWriteResult>[] = [];

  // ensure index is created
  await MU.col(client).createIndex({ username: 1 }, { unique: true });

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

        const hiscore = await getHiscore(agent, username);
        if (!hiscore) return mapArrayPush(failedMap, scrapingOffset, username);

        // add hiscoreEntry to player.hiscoreEntries via bulkWriteOp
        bulkUpdateOps.push(
          MU.hiscoreEntryBulkWriteOp(username, { sourceString: hiscore, date: scrapeTime, scrapingOffset }),
        );
      }),
    );

    // Only bulk update if there are any updates, can be empty if all usernames failed
    if (bulkUpdateOps.length) bulkWrites.push(MU.col(client).bulkWrite(bulkUpdateOps));
  }

  // wait for all bulk writes to finish
  const bulkWriteResults = await Promise.all(bulkWrites);
  const updatedPlayerCount = bulkWriteResults.reduce((acc, result) => acc + result.modifiedCount, 0);
  const failedMessagesCount = [...failedMap.values()].flat().length;

  // throw error if no players were updated. Dont send new SQS messages or we will get stuck in a loop
  if (updatedPlayerCount === 0 && maxReceiveCount > 1) {
    await discordAlert('No players were updated', [...failedMap.values()].flat(), context);

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
      chunk(failedMessages, SQS_MESSAGE_BATCH_SIZE).map((messageBatch) =>
        sqsClient.send(new SendMessageBatchCommand({ QueueUrl: process.env.SQS_QUEUE_URL!, Entries: messageBatch })),
      ),
    );
  }

  console.log(
    `Updated ${updatedPlayerCount} players successfully.`,
    `Failed to update ${failedMessagesCount} players.`,
  );

  if (failedMessagesCount && maxReceiveCount > 1) {
    await discordAlert('Failed to process some players', [...failedMap.values()].flat(), context);
  }

  return context.logStreamName;
};
