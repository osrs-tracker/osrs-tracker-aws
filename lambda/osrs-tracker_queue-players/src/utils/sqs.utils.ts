import { SendMessageBatchCommand, SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';
import { DRY_RUN, logDryRun } from './dry-run.utils';

export function createMessage(usernames: string[], scrapingOffset: number) {
  return {
    Id: randomUUID(),
    MessageBody: JSON.stringify({ usernames, scrapingOffset }),
  };
}

export async function sendMessageBatch(sqsClient: SQSClient, messageBatch: SendMessageBatchRequestEntry[]) {
  if (DRY_RUN) return logDryRun(`send ${messageBatch.length} SQS messages`, messageBatch);

  console.info(messageBatch);
  return sqsClient.send(new SendMessageBatchCommand({ QueueUrl: process.env.SQS_QUEUE_URL!, Entries: messageBatch }));
}
