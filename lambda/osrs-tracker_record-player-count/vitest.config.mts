import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // validated at import (src/env.ts). The specs hand the handler a client of an in-memory MongoDB and stub fetch:
    // neither URL is used
    env: {
      // nothing listens on port 1: a connection made by mistake fails at once
      MONGODB_URI: 'mongodb://127.0.0.1:1',
      MONGODB_DATABASE: 'test',
      MONGODB_COLLECTION: 'playerCounts',
      MONGODB_DAILY_COLLECTION: 'playerCountsDaily',
      DRY_RUN: 'false',
      WEBHOOK_URL: 'https://discord.invalid/webhook',
    },
  },
});
