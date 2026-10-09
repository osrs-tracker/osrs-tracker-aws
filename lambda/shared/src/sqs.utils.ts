import {
  BatchResultErrorEntry,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';
import { DRY_RUN, logDryRun } from './dry-run.utils';
import { env } from '@lambda/env';

export function createMessage(usernames: string[], scrapingOffset: number) {
  return {
    Id: randomUUID(),
    MessageBody: JSON.stringify({ usernames, scrapingOffset }),
  };
}

/**
 * Sends a batch of messages. The call can succeed while SQS rejects single entries, so this returns (and logs) the
 * rejected entries. Empty in `DRY_RUN`.
 */
export async function sendMessageBatch(
  sqsClient: SQSClient,
  messageBatch: SendMessageBatchRequestEntry[],
): Promise<BatchResultErrorEntry[]> {
  if (DRY_RUN) {
    logDryRun(`send ${messageBatch.length} SQS messages`, messageBatch);
    return [];
  }

  const { Failed = [] } = await sqsClient.send(
    new SendMessageBatchCommand({ QueueUrl: env.SQS_QUEUE_URL, Entries: messageBatch }),
  );

  Failed.forEach(({ Id, Code, Message }) => console.error('SQS rejected message', { Id, Code, Message }));

  return Failed;
}
