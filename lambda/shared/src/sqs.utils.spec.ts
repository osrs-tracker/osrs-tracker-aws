import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMessage, sendMessageBatch } from './sqs.utils';

const QUEUE_URL = 'https://sqs.invalid/queue';

describe('createMessage', () => {
  it('puts the usernames and offset in the body, under a new id', () => {
    const [first, second] = [createMessage(['alice', 'bob'], 3), createMessage(['alice', 'bob'], 3)];

    expect(JSON.parse(first.MessageBody)).toEqual({ usernames: ['alice', 'bob'], scrapingOffset: 3 });
    expect(first.Id).not.toBe(second.Id);
  });
});

describe('sendMessageBatch', () => {
  const batch = [createMessage(['alice'], 0), createMessage(['bob'], 1)];
  const send = vi.fn();
  const client = { send } as unknown as SQSClient;

  beforeEach(() => {
    send.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('sends the batch to the queue and returns nothing when SQS accepts it', async () => {
    send.mockResolvedValue({ Successful: [] });

    expect(await sendMessageBatch(client, QUEUE_URL, batch)).toEqual([]);
    expect(send).toHaveBeenCalledExactlyOnceWith(expect.any(SendMessageBatchCommand));
    expect(send.mock.calls[0][0].input).toEqual({ QueueUrl: QUEUE_URL, Entries: batch });
  });

  it('returns the entries SQS rejected', async () => {
    const rejected = { Id: batch[1].Id, SenderFault: false, Code: 'InternalError' };
    send.mockResolvedValue({ Failed: [rejected] });

    expect(await sendMessageBatch(client, QUEUE_URL, batch)).toEqual([rejected]);
  });

  it('never rejects: a failed call returns every entry as rejected', async () => {
    send.mockRejectedValue(new Error('socket hang up'));

    expect(await sendMessageBatch(client, QUEUE_URL, batch)).toEqual(
      batch.map(({ Id }) => ({ Id, SenderFault: false, Code: 'SendFailed', Message: 'Error: socket hang up' })),
    );
  });
});
