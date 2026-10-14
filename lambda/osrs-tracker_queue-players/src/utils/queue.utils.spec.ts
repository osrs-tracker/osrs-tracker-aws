import { describe, expect, it } from 'vitest';
import { SQS_MESSAGE_BATCH_SIZE } from '@lambda/shared/sqs.utils';
import { messageBatches, scrapingOffsetForHour } from './queue.utils';

describe('scrapingOffsetForHour', () => {
  it.each([
    ['00:00', 0],
    ['11:59', 11],
    ['12:00', -12],
    ['23:00', -1],
  ])('maps %s UTC to offset %i', (time, offset) => {
    expect(scrapingOffsetForHour(new Date(`2026-10-02T${time}:00Z`))).toBe(offset);
  });
});

describe('messageBatches', () => {
  // not SQS_MESSAGE_BATCH_SIZE (10), so a mix-up of the two sizes fails
  const perMessage = 3;

  const names = (count: number, from = 1) => Array.from({ length: count }, (_, i) => `player ${from + i}`);

  async function* source(usernames: string[], read = { count: 0 }) {
    for (const username of usernames) {
      read.count++;
      yield username;
    }
  }

  // Array.fromAsync is ES2024, past the Lambdas' `lib`
  async function batchesFor(count: number) {
    const batches: string[][][] = [];
    for await (const batch of messageBatches(source(names(count)), perMessage)) batches.push(batch);
    return batches;
  }

  it('yields nothing without usernames', async () => {
    expect(await batchesFor(0)).toEqual([]);
  });

  it('sends a single username in a partial message', async () => {
    expect(await batchesFor(1)).toEqual([[['player 1']]]);
  });

  it('fills exactly one message', async () => {
    expect(await batchesFor(perMessage)).toEqual([[names(perMessage)]]);
  });

  it('starts a new batch after SQS_MESSAGE_BATCH_SIZE messages and sends the last partial message', async () => {
    const count = SQS_MESSAGE_BATCH_SIZE * perMessage + 1;
    const batches = await batchesFor(count);

    expect(batches).toHaveLength(2);
    expect(batches[0]).toEqual(
      Array.from({ length: SQS_MESSAGE_BATCH_SIZE }, (_, i) => names(perMessage, i * perMessage + 1)),
    );
    expect(batches[1]).toEqual([[`player ${count}`]]);
    expect(batches.flat(2)).toEqual(names(count));
  });

  it('yields a full batch before reading the next username', async () => {
    const read = { count: 0 };
    const batches = messageBatches(source(names(100), read), perMessage);

    await batches.next();

    expect(read.count).toBe(SQS_MESSAGE_BATCH_SIZE * perMessage);
  });
});
