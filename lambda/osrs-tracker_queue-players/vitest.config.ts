import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // as `alias` in lambda/shared/build/esbuild.js. Bare imports in lambda/shared/ (no node_modules) need nothing extra:
  // Vitest resolves an import that fails from the importing file's folder again from this Lambda's root
  resolve: { alias: { '@lambda/shared': fileURLToPath(new URL('../shared/src', import.meta.url)) } },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // read at import by lambda/shared/src/env.ts, through the shared `SQS_MESSAGE_BATCH_SIZE` import. Specs never
    // connect to MONGODB_URI
    env: {
      MONGODB_URI: 'mongodb://localhost',
      MONGODB_DATABASE: 'test',
      MONGODB_COLLECTION: 'players',
    },
  },
});
