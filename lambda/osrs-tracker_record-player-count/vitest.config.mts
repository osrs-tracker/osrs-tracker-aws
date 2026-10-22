import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // validated at import (src/env.ts). The specs mock the world list and the SQS send, and stub fetch: no URL is used
    env: {
      DRY_RUN: 'false',
      SCRAPE_RESULTS_QUEUE_URL: 'https://sqs.invalid/osrs-tracker_scrape-results.fifo',
      WEBHOOK_URL: 'https://discord.invalid/webhook',
    },
  },
});
