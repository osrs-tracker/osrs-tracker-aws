/**
 * The ESLint config of every Lambda (each Lambda's eslint.config.mjs re-exports it) and of lambda/shared/ itself, which a
 * Lambda's `npm run lint` lints too (`eslint . ../shared`, each file with the config nearest to it). lambda/shared/ has
 * no node_modules, so the plugins load from the Lambda's: run ESLint from a Lambda folder.
 *
 * No rule needs type information, so files are parsed without a TypeScript project: a shared file a Lambda doesn't import
 * isn't in that Lambda's project. `npx tsc --noEmit -p .` type-checks the shared files each Lambda imports.
 */
import { createRequire } from 'module';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const lambdaRequire = createRequire(resolve('package.json'));
const load = async (name) => (await import(pathToFileURL(lambdaRequire.resolve(name)).href)).default;

const [stylistic, globals, tseslint] = await Promise.all(
  ['@stylistic/eslint-plugin', 'globals', 'typescript-eslint'].map(load),
);

const rules = {
  '@stylistic/indent': ['error', 2],
  '@stylistic/member-delimiter-style': [
    'error',
    {
      multiline: {
        delimiter: 'semi',
        requireLast: true,
      },
      singleline: {
        delimiter: 'semi',
        requireLast: false,
      },
    },
  ],
  '@stylistic/quotes': [
    'error',
    'single',
    {
      avoidEscape: true,
    },
  ],
  '@stylistic/semi': ['error', 'always'],
  'comma-dangle': ['error', 'always-multiline'],
  'max-classes-per-file': 'off',
  'no-multiple-empty-lines': ['error', { max: 1 }],
  'no-redeclare': 'error',
  'no-return-await': 'error',
  'prefer-const': 'error',
};

export default tseslint.config(
  {
    ignores: ['node_modules', '.vscode', 'dist/'],
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    plugins: { '@stylistic': stylistic },
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
    plugins: { '@stylistic': stylistic },
    rules: rules,
  },
);
