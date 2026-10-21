import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // lambda/shared has no scripts of its own: its specs run here, as its lint does
    include: ['src/**/*.spec.ts', '../shared/src/**/*.spec.ts'],
    environment: 'node',
    // read and validated when src/env.ts and ../shared/src/env.ts load. Nothing connects to these: the in-memory MongoDB
    // specs pass their own client, and fetch and Lambda are mocked
    env: {
      // nothing listens on port 1: a connection made by mistake fails at once
      MONGODB_URI: 'mongodb://127.0.0.1:1',
      MONGODB_DATABASE: 'test',
      MONGODB_COLLECTION: 'players',
      DRY_RUN: 'false',
      OSRS_API_BASE_URL: 'https://hiscores.invalid',
      PLAYERS_PER_EVENT: '2',
      WEBHOOK_URL: 'https://discord.invalid/webhook',
    },
  },
});
