import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // read at import by src/env.ts and lambda/shared/src/env.ts. Specs never reach these: the handler spec mocks
    // scanSubscriptions, invokeAsync and discordAlert
    env: {
      DRY_RUN: 'false',
      PLAYERS_PER_EVENT: '2',
      PROCESS_PLAYERS_FUNCTION: 'process-players',
      SUBSCRIPTIONS_TABLE: 'osrs-tracker_subscriptions',
      WEBHOOK_URL: 'https://discord.invalid/webhook',
    },
  },
});
