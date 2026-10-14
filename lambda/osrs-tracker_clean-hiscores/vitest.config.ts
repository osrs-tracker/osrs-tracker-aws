import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // as `alias` in lambda/shared/build/esbuild.js. Bare imports in lambda/shared/ (no node_modules) need nothing extra:
  // Vitest resolves an import that fails from the importing file's folder again from this Lambda's root
  resolve: { alias: { '@lambda/shared': fileURLToPath(new URL('../shared/src', import.meta.url)) } },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // read at import by src/env.ts and lambda/shared/src/env.ts. Specs never connect to MONGODB_URI or WEBHOOK_URL:
    // the MongoDB specs pass their own in-memory client, the handler spec mocks MU and discordAlert
    env: {
      MONGODB_URI: 'mongodb://localhost',
      MONGODB_DATABASE: 'test',
      MONGODB_COLLECTION: 'players',
      MAX_AGE_IN_DAYS: '90',
      WEBHOOK_URL: 'https://discord.invalid/webhook',
    },
  },
});
