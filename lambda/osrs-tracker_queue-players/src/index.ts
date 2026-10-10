import { BatchResultErrorEntry, SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs';
import { Context, ScheduledEvent } from 'aws-lambda';
import { discordAlert } from '@lambda/shared/discord-alert';
import { ensureIndex } from '@lambda/shared/mongo.utils';
import { MU } from './utils/mongo.utils';
import { createMessage, sendMessageBatch, SQS_MESSAGE_BATCH_SIZE } from '@lambda/shared/sqs.utils';
import { env } from './env';

const sqsClient = new SQSClient({ region: 'eu-central-1' });

const client = MU.client();

export const handler = async (event: ScheduledEvent, context: Context) => {
  // current scrapeOffset, -12 to 11
  const scrapingOffset = ((12 + new Date(event.time).getUTCHours()) % 24) - 12;

  // ensure index on scrapingOffsets
  await ensureIndex(MU.col(client), { scrapingOffsets: 1 }, { sparse: true });

  // get usernames for scrapingOffset as cursor
  const usernameCursor = MU.getAllUsernamesForOffset(client, scrapingOffset);

  // statistics
  let usernamesProcessed = 0;
  let messagesCreated = 0;
  let commandsExecuted = 0;
  // entries SQS rejected or that failed to send, each logged by `sendMessageBatch`
  const errors: BatchResultErrorEntry[] = [];

  // temporary arrays
  const usernames: string[] = [];
  const messageBatch: SendMessageBatchRequestEntry[] = [];

  try {
    for await (const username of usernameCursor) {
      // add username to usernames array
      usernames.push(username);
      usernamesProcessed++;

      // if usernames array is smaller then PLAYERS_PER_SQS_MESSAGE,
      if (usernames.length < env.PLAYERS_PER_SQS_MESSAGE) continue;

      // if usernames array is full, add message to batch
      messageBatch.push(createMessage(usernames, scrapingOffset));
      messagesCreated++;
      usernames.length = 0;

      // if batch is full, send batch
      if (messageBatch.length === SQS_MESSAGE_BATCH_SIZE) {
        errors.push(...(await sendMessageBatch(sqsClient, env.SQS_QUEUE_URL, messageBatch)));
        commandsExecuted++;
        messageBatch.length = 0;
      }
    }
  } finally {
    // close the cursor
    await usernameCursor.close();
  }

  // send last batch
  if (usernames.length) {
    messageBatch.push(createMessage(usernames, scrapingOffset));
    messagesCreated++;
  }
  if (messageBatch.length) {
    errors.push(...(await sendMessageBatch(sqsClient, env.SQS_QUEUE_URL, messageBatch)));
    commandsExecuted++;
  }

  console.log('RESULT: ', {
    usernamesProcessed,
    messagesCreated,
    commandsExecuted,
    errors: errors.length,
  });

  // each error is already logged where it happened
  if (errors.length)
    await discordAlert(env.WEBHOOK_URL, 'Failed to queue players', `Error count: ${errors.length}`, context);

  return context.logStreamName;
};
