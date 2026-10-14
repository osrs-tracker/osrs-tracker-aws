import { BatchResultErrorEntry, SQSClient } from '@aws-sdk/client-sqs';
import { Context, ScheduledEvent } from 'aws-lambda';
import { discordAlert } from '@lambda/shared/discord-alert';
import { ensureIndex } from '@lambda/shared/mongo.utils';
import { logCommit } from '@lambda/shared/commit';
import { MU } from './utils/mongo.utils';
import { messageBatches, scrapingOffsetForHour } from './utils/queue.utils';
import { createMessage, sendMessageBatch } from '@lambda/shared/sqs.utils';
import { env } from './env';

logCommit();

const sqsClient = new SQSClient({ region: 'eu-central-1' });

const client = MU.client();

export const handler = async (event: ScheduledEvent, context: Context) => {
  const scrapingOffset = scrapingOffsetForHour(new Date(event.time));

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

  try {
    for await (const batch of messageBatches(usernameCursor, env.PLAYERS_PER_SQS_MESSAGE)) {
      usernamesProcessed += batch.flat().length;
      messagesCreated += batch.length;

      const messageBatch = batch.map((usernames) => createMessage(usernames, scrapingOffset));
      errors.push(...(await sendMessageBatch(sqsClient, env.SQS_QUEUE_URL, messageBatch)));
      commandsExecuted++;
    }
  } finally {
    // close the cursor
    await usernameCursor.close();
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
