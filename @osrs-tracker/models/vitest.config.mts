import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // downloads the in-memory MongoDB binary once, before the *.int.spec.ts files start in parallel
    globalSetup: ['src/mongodb.global-setup.ts'],
  },
});
