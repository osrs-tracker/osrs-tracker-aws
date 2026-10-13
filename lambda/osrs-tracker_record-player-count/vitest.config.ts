import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // as in ../shared/build/esbuild.js
  resolve: { alias: { '@lambda/shared': resolve(__dirname, '../shared/src') } },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
