/**
 * The ESLint config of every Lambda and every @osrs-tracker package (each one's eslint.config.mjs re-exports it) and of
 * lambda/shared/ itself. process-players' `npm run lint` also lints lambda/shared/ (`eslint . ../shared`, each file with
 * the config nearest to it), so shared code is linted once; CI and the push hook run every Lambda's lint when shared code
 * changes, and CI every package's when this file does.
 *
 * No rule needs type information, so files are parsed without a TypeScript project: a shared file a Lambda doesn't import
 * isn't in that Lambda's project. `npx tsc --noEmit -p .` type-checks the shared files each Lambda imports.
 */
import { createRequire } from 'module';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

// Not plain imports, which resolve from lambda/node_modules: package CI installs only the package it checks. So load the
// plugins from the folder ESLint runs in (a package, or a Lambda through the workspace's hoisted node_modules), or else
// (an editor, or ESLint run from the repo root) from lambda/node_modules
const candidates = [resolve('package.json'), new URL('../package.json', import.meta.url)];
const resolvePlugin = (name) => {
  for (const candidate of candidates) {
    try {
      return createRequire(candidate).resolve(name);
    } catch {
      // not installed there, try the next
    }
  }
  throw new Error(`${name} not found: run npm ci in lambda/ or the package folder`);
};
const load = async (name) => (await import(pathToFileURL(resolvePlugin(name)).href)).default;

const [globals, tseslint] = await Promise.all(['globals', 'typescript-eslint'].map(load));

// Formatting is Prettier's (the root .prettierrc.json): no rule here may overlap it
const rules = {
  'no-redeclare': 'error',
  'no-return-await': 'error',
  'prefer-const': 'error',
};

export default tseslint.config(
  {
    ignores: ['node_modules', 'dist/'],
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: rules,
  },
  {
    files: ['**/*.{ts,mts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
      parser: tseslint.parser,
    },
    rules: rules,
  },
);
