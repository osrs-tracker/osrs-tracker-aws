import { SQS_MESSAGE_BATCH_SIZE } from '@lambda/shared/sqs.utils';

/** The scraping offset to queue at `date`'s UTC hour, -12 to 11: hours 0 to 11 queue 0 to 11, hours 12 to 23 -12 to -1. */
export function scrapingOffsetForHour(date: Date): number {
  return ((12 + date.getUTCHours()) % 24) - 12;
}

/**
 * Groups `usernames` into messages of `usernamesPerMessage` usernames, and those into batches of
 * `SQS_MESSAGE_BATCH_SIZE` messages, one per `SendMessageBatch` call. The last message and the last batch may be partial.
 * A full batch is yielded as soon as it fills, while `usernames` is still being read.
 */
export function messageBatches(
  usernames: AsyncIterable<string>,
  usernamesPerMessage: number,
): AsyncGenerator<string[][]> {
  return chunks(chunks(usernames, usernamesPerMessage), SQS_MESSAGE_BATCH_SIZE);
}

/** Splits `source` into arrays of `size` items, the last one shorter. Node has no async iterator helpers to do this yet. */
async function* chunks<T>(source: AsyncIterable<T>, size: number): AsyncGenerator<T[]> {
  let chunk: T[] = [];
  for await (const item of source) {
    chunk.push(item);
    if (chunk.length < size) continue;

    yield chunk;
    chunk = [];
  }
  if (chunk.length) yield chunk;
}
