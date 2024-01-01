import { SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs';
import { Context, ScheduledEvent } from 'aws-lambda';
import { AuthMechanism, MongoClient } from 'mongodb';
import { MU } from './utils/mongo.utils';
import { createMessage, sendMessageBatch } from './utils/sqs.utils';

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

export const handler = async (event: ScheduledEvent, context: Context) => {
  // current scrapeOffset, -12 to 11
  const scrapingOffset = ((12 + new Date(event.time).getUTCHours()) % 24) - 12;

  // ensure index on scrapingOffsets
  await MU.col(client).createIndex({ scrapingOffsets: 1 }, { sparse: true });

  // get usernames for scrapingOffset as cursor
  const usernameCursor = MU.getAllUsernamesForOffset(client, scrapingOffset);

  // statistics
  let usernamesProcessed = 0;
  let messagesCreated = 0;
  let commandsExecuted = 0;
  const errors: any[] = [];

  // temporary arrays
  const usernames: string[] = [];
  const messageBatch: SendMessageBatchRequestEntry[] = [];

  for await (const username of usernameCursor) {
    // add username to usernames array
    usernames.push(username);
    usernamesProcessed++;

    // if usernames array is smaller then PLAYERS_PER_SQS_MESSAGE,
    if (usernames.length < parseInt(process.env.PLAYERS_PER_SQS_MESSAGE!)) continue;

    // if usernames array is full, add message to batch
    messageBatch.push(createMessage(usernames, scrapingOffset));
    messagesCreated++;
    usernames.length = 0;

    // if batch is full, send batch
    if (messageBatch.length === SQS_MESSAGE_BATCH_SIZE) {
      await sendMessageBatch(sqsClient, messageBatch).catch((e) => errors.push(e));
      commandsExecuted++;
      messageBatch.length = 0;
    }
  }

  // send last batch
  if (usernames.length) {
    messageBatch.push(createMessage(usernames, scrapingOffset));
    messagesCreated++;
  }
  if (messageBatch.length) {
    await sendMessageBatch(sqsClient, messageBatch).catch((e) => errors.push(e));
    commandsExecuted++;
  }

  console.log('RESULT: ', {
    usernamesProcessed,
    messagesCreated,
    commandsExecuted,
    errors: errors.length,
  });

  if (errors.length) {
    errors.forEach((e) => console.error(e));
  }

  return context.logStreamName;
};
