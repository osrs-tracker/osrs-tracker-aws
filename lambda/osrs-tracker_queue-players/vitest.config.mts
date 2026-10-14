import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // read at import by lambda/shared/src/env.ts, through the shared `SQS_MESSAGE_BATCH_SIZE` import. Specs never
    // connect to MONGODB_URI
    env: {
      // nothing listens on port 1: a connection made by mistake fails at once
      MONGODB_URI: 'mongodb://127.0.0.1:1',
      MONGODB_DATABASE: 'test',
      MONGODB_COLLECTION: 'players',
      DRY_RUN: 'false',
    },
  },
});
