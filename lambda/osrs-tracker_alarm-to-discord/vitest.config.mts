import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // validated at import (src/env.ts). No MongoDB variables: this Lambda must load without them. fetch is mocked
    env: {
      DRY_RUN: 'false',
      WEBHOOK_URL: 'https://discord.invalid/webhook',
    },
  },
});
