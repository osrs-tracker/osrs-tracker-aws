import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // lambda/shared has no scripts of its own: its specs run here, as its lint does
    include: ['src/**/*.spec.ts', '../shared/src/**/*.spec.ts'],
    environment: 'node',
    // read and validated when src/env.ts and ../shared/src/env.ts load. Nothing connects to these: fetch, Lambda and SQS
    // are mocked
    env: {
      DRY_RUN: 'false',
      OSRS_API_BASE_URL: 'https://hiscores.invalid',
      PLAYERS_PER_EVENT: '2',
      SCRAPE_RESULTS_QUEUE_URL: 'https://sqs.invalid/osrs-tracker_scrape-results.fifo',
      WEBHOOK_URL: 'https://discord.invalid/webhook',
    },
  },
});
