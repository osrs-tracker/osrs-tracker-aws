import { SendMessageBatchCommand, SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';

export function createMessage(usernames: string[], scrapingOffset: number) {
  return {
    Id: randomUUID(),
    MessageBody: JSON.stringify({ usernames, scrapingOffset }),
  };
}

export function sendMessageBatch(sqsClient: SQSClient, messageBatch: SendMessageBatchRequestEntry[]) {
  return sqsClient.send(new SendMessageBatchCommand({ QueueUrl: process.env.SQS_QUEUE_URL!, Entries: messageBatch }));
}
