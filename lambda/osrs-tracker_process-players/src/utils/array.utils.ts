/** Splits an array into chunks of `size` elements; the last chunk holds the rest. Like lodash's, empty if `size < 1`. */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  if (!(size >= 1)) return chunks;

  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}
