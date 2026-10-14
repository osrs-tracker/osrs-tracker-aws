import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // read at import by src/env.ts and lambda/shared/src/env.ts. Specs never connect to MONGODB_URI or WEBHOOK_URL:
    // the MongoDB specs pass their own in-memory client, the handler spec mocks MU and discordAlert
    env: {
      // nothing listens on port 1: a connection made by mistake fails at once
      MONGODB_URI: 'mongodb://127.0.0.1:1',
      MONGODB_DATABASE: 'test',
      MONGODB_COLLECTION: 'players',
      DRY_RUN: 'false',
      MAX_AGE_IN_DAYS: '90',
      WEBHOOK_URL: 'https://discord.invalid/webhook',
    },
  },
});
