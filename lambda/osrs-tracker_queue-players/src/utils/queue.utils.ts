/** The scraping offset to queue at `date`'s UTC hour, -12 to 11: hours 0 to 11 queue 0 to 11, hours 12 to 23 -12 to -1. */
export function scrapingOffsetForHour(date: Date): number {
  return ((12 + date.getUTCHours()) % 24) - 12;
}

/**
 * Splits `source` into arrays of `size` items, the last one shorter. A full array is yielded as soon as it fills, while
 * `source` is still being read. Node has no async iterator helpers to do this yet.
 */
export async function* chunks<T>(source: AsyncIterable<T>, size: number): AsyncGenerator<T[]> {
  let chunk: T[] = [];
  for await (const item of source) {
    chunk.push(item);
    if (chunk.length < size) continue;

    yield chunk;
    chunk = [];
  }
  if (chunk.length) yield chunk;
}
