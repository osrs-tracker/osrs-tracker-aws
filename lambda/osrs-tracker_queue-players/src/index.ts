import { BatchResultErrorEntry, SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs';
import { Context, ScheduledEvent } from 'aws-lambda';
import { discordAlert } from './utils/discord-alert';
import { MU } from './utils/mongo.utils';
import { createMessage, sendMessageBatch } from './utils/sqs.utils';
import { env } from './env';

const SQS_MESSAGE_BATCH_SIZE = 10; // max 10

const sqsClient = new SQSClient({ region: 'eu-central-1' });

const client = MU.client();

/** Sends a batch, adding entries SQS rejected (logged by `sendMessageBatch`) and a thrown error to `errors`. */
async function sendBatch(messageBatch: SendMessageBatchRequestEntry[], errors: (Error | BatchResultErrorEntry)[]) {
  await sendMessageBatch(sqsClient, messageBatch).then(
    (failed) => errors.push(...failed),
    (e) => {
      console.error('Failed to send SQS message batch', e);
      errors.push(e);
    },
  );
}

export const handler = async (event: ScheduledEvent, context: Context) => {
  // current scrapeOffset, -12 to 11
  const scrapingOffset = ((12 + new Date(event.time).getUTCHours()) % 24) - 12;

  // ensure index on scrapingOffsets
  await MU.ensureIndex(client, { scrapingOffsets: 1 }, { sparse: true, background: true });

  // get usernames for scrapingOffset as cursor
  const usernameCursor = MU.getAllUsernamesForOffset(client, scrapingOffset);

  // statistics
  let usernamesProcessed = 0;
  let messagesCreated = 0;
  let commandsExecuted = 0;
  const errors: (Error | BatchResultErrorEntry)[] = [];

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
        await sendBatch(messageBatch, errors);
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
    await sendBatch(messageBatch, errors);
    commandsExecuted++;
  }

  console.log('RESULT: ', {
    usernamesProcessed,
    messagesCreated,
    commandsExecuted,
    errors: errors.length,
  });

  // each error is already logged where it happened
  if (errors.length) await discordAlert('Failed to queue players', errors, context);

  return context.logStreamName;
};
