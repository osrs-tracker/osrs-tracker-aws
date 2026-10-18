import { MongoBinary } from 'mongodb-memory-server';

/** Production runs MongoDB 8.0 (Atlas). */
export const MONGODB_VERSION = '8.0.12';

/**
 * Vitest `globalSetup`: downloads the binary once, before the spec files start. Each `*.int.spec.ts` runs in its own
 * fork, and mongodb-memory-server's download lock is check-then-write, so two forks on a runner without the binary
 * could both download it, and the second rename failed and hung that spec's `beforeAll`.
 */
export async function setup(): Promise<void> {
  await MongoBinary.getPath({ version: MONGODB_VERSION });
}
