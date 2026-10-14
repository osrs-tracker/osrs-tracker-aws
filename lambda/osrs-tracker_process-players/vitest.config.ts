import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // as `alias` in lambda/shared/build/esbuild.js. Bare imports in lambda/shared/ (no node_modules) need nothing extra:
  // Vitest resolves an import that fails from the importing file's folder again from this Lambda's root
  resolve: { alias: { '@lambda/shared': fileURLToPath(new URL('../shared/src', import.meta.url)) } },
  test: {
    // lambda/shared has no package.json of its own: its specs run here, as its lint does
    include: ['src/**/*.spec.ts', '../shared/src/**/*.spec.ts'],
    environment: 'node',
    // read and validated when src/env.ts and ../shared/src/env.ts load. Nothing connects to these: the in-memory MongoDB
    // specs pass their own client, and fetch and SQS are mocked
    env: {
      // nothing listens on port 1: a connection made by mistake fails at once
      MONGODB_URI: 'mongodb://127.0.0.1:1',
      MONGODB_DATABASE: 'test',
      MONGODB_COLLECTION: 'players',
      DRY_RUN: 'false',
      OSRS_API_BASE_URL: 'https://hiscores.invalid',
      PLAYERS_PER_SQS_MESSAGE: '2',
      SQS_QUEUE_URL: 'https://sqs.invalid/queue',
      WEBHOOK_URL: 'https://discord.invalid/webhook',
    },
  },
});
