/**
 * The ESLint config of every Lambda (each Lambda's eslint.config.mjs re-exports it) and of lambda/shared/ itself.
 * process-players' `npm run lint` also lints lambda/shared/ (`eslint . ../shared`, each file with the config nearest to
 * it), so shared code is linted once; CI and the push hook run every Lambda's lint when shared code changes.
 *
 * No rule needs type information, so files are parsed without a TypeScript project: a shared file a Lambda doesn't import
 * isn't in that Lambda's project. `npx tsc --noEmit -p .` type-checks the shared files each Lambda imports.
 */
import { readdirSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// lambda/shared/ has no node_modules: load the plugins from the Lambda ESLint runs in, or else (an editor, or ESLint run
// from the repo root) from the first Lambda that has them installed
const lambdaDir = dirname(dirname(fileURLToPath(import.meta.url)));
const candidates = [
  resolve('package.json'),
  ...readdirSync(lambdaDir)
    .filter((name) => name !== 'shared')
    .map((name) => join(lambdaDir, name, 'package.json')),
];
const resolvePlugin = (name) => {
  for (const candidate of candidates) {
    try {
      return createRequire(candidate).resolve(name);
    } catch {
      // not installed there, try the next
    }
  }
  throw new Error(`${name} not found: run npm ci in a Lambda folder`);
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
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
      parser: tseslint.parser,
    },
    rules: rules,
  },
);
