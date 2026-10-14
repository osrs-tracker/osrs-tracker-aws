import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // as `alias` in lambda/shared/build/esbuild.js. Bare imports in lambda/shared/ (no node_modules) need nothing extra:
  // Vitest resolves an import that fails from the importing file's folder again from this Lambda's root
  resolve: { alias: { '@lambda/shared': fileURLToPath(new URL('../shared/src', import.meta.url)) } },
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
