import { SendMessageBatchCommand, SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs';
import { HiscoreEntry, PlayerScrapeMessageBody, PlayerWithHiscores } from '@osrs-tracker/models';
import { Context, SQSEvent } from 'aws-lambda';
import { Agent } from 'https';
import chunk from 'lodash.chunk';
import { AnyBulkWriteOperation, AuthMechanism, MongoClient } from 'mongodb';
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
  const messageBodies: PlayerScrapeMessageBody[] = event.Records.map((record) => JSON.parse(record.body));

  let updatedPlayerCount = 0;
  const failedUsernameMap: Map<number, string[]> = new Map();

  // scrape each message body sequentially
  for (const messageBody of messageBodies) {
    const { usernames, scrapingOffset } = messageBody;

    const scrapeTime = new Date();
    const bulkUpdateOps: AnyBulkWriteOperation<PlayerWithHiscores>[] = [];

    // scrape each username from body in parallel and wait for all to finish
    await Promise.allSettled(
      usernames.map(async (username) => {
        // fetch hiscores
        const hiscore = await getHiscore(agent, username);
        if (!hiscore)
          return failedUsernameMap.set(scrapingOffset, [...(failedUsernameMap.get(scrapingOffset) ?? []), username]);

        // add prepend hiscoreEntry to player.hiscoreEntries
        bulkUpdateOps.push({
          updateOne: {
            filter: { username },
            hint: { username: 1 },
            update: {
              $push: {
                hiscoreEntries: {
                  $each: [new HiscoreEntry(hiscore, scrapeTime, scrapingOffset)],
                  $position: 0,
                },
              },
            },
          },
        });
      }),
    );

    // Only bulk update if there are any updates, can be empty if all usernames failed
    if (bulkUpdateOps.length) {
      const { modifiedCount } = await MU.col(client).bulkWrite(bulkUpdateOps);
      updatedPlayerCount += modifiedCount;
    }
  }

  // throw error if no players were updated. Dont send new SQS messages or we will get stuck in a loop
  if (updatedPlayerCount === 0) {
    throw new Error(
      `No players were updated. Failed to update ${[...failedUsernameMap.values()].flat().length} players.`,
    );
  }

  // If some usernames updated successfully and some failed, send new SQS messages for the failed usernames
  if (failedUsernameMap.size > 0) {
    const failedMessages: SendMessageBatchRequestEntry[] = [];

    // create messages from failed usernames
    failedUsernameMap.forEach((usernames, scrapingOffset) =>
      failedMessages.push(
        ...chunk(usernames, parseInt(process.env.PLAYERS_PER_SQS_MESSAGE!)).map((usernameBatch) =>
          createMessage(usernameBatch, scrapingOffset),
        ),
      ),
    );

    // send failed messages in batches
    const failedBatches = chunk(failedMessages, SQS_MESSAGE_BATCH_SIZE).map((messageBatch) =>
      sqsClient.send(new SendMessageBatchCommand({ QueueUrl: process.env.SQS_QUEUE_URL!, Entries: messageBatch })),
    );

    await Promise.all(failedBatches);
  }

  console.log(
    `Updated ${updatedPlayerCount} players successfully.`,
    `Failed to update ${[...failedUsernameMap.values()].flat().length} players.`,
  );

  return context.logStreamName;
};
