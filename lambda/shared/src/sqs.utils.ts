import {
  BatchResultErrorEntry,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';
import { DRY_RUN, logDryRun } from './dry-run.utils';

/** The most entries SQS accepts in one `SendMessageBatch` call. */
export const SQS_MESSAGE_BATCH_SIZE = 10;

export function createMessage(usernames: string[], scrapingOffset: number) {
  return {
    Id: randomUUID(),
    MessageBody: JSON.stringify({ usernames, scrapingOffset }),
  };
}

/**
 * Sends a batch of messages to `queueUrl`. The call can succeed while SQS rejects single entries, so this returns (and
 * logs) the rejected entries. Never rejects: a call that fails returns every entry as rejected, so process-players can
 * use it after its bulk writes. Empty in `DRY_RUN`.
 */
export async function sendMessageBatch(
  sqsClient: SQSClient,
  queueUrl: string,
  messageBatch: SendMessageBatchRequestEntry[],
): Promise<BatchResultErrorEntry[]> {
  if (DRY_RUN) {
    logDryRun(`send ${messageBatch.length} SQS messages`, messageBatch);
    return [];
  }

  let Failed: BatchResultErrorEntry[];
  try {
    ({ Failed = [] } = await sqsClient.send(
      new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries: messageBatch }),
    ));
  } catch (e) {
    console.error('Failed to send SQS message batch', e);
    return messageBatch.map(({ Id }) => ({ Id, SenderFault: false, Code: 'SendFailed', Message: String(e) }));
  }

  Failed.forEach(({ Id, Code, Message }) => console.error('SQS rejected message', { Id, Code, Message }));

  return Failed;
}
