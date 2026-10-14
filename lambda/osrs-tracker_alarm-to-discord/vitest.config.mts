import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // as `alias` in lambda/shared/build/esbuild.js. Bare imports in lambda/shared/ (no node_modules) need nothing extra:
  // Vitest resolves an import that fails from the importing file's folder again from this Lambda's root
  resolve: { alias: { '@lambda/shared': fileURLToPath(new URL('../shared/src', import.meta.url)) } },
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
