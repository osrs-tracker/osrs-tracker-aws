/**
 * Bundles a Lambda (run from its folder, via its `npm run build` or `invoke:dry`): `src/index.ts` with everything it
 * imports, including lambda/shared/, into `dist/index.js`. Flag: `--dev` (source map, no minify).
 *
 * The bundle carries the commit it's built from (`__COMMIT__`), which src/commit.ts logs at cold start.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { parseArgs } = require('util');

const { values: argv } = parseArgs({
  options: { dev: { type: 'boolean' } },
});

const esbuild = require('esbuild');

/** `git rev-parse --short HEAD`, plus `-dirty` when lambda/ has uncommitted changes, or `unknown` without git. */
function commit() {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    return git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain', '--', '.') ? '-dirty' : '');
  } catch {
    return 'unknown';
  }
}

/** @type import('esbuild').BuildOptions */
const devConfig = {
  sourcemap: 'linked',
};

/** @type import('esbuild').BuildOptions */
const prodConfig = {
  minify: true,
};

/** @type import('esbuild').BuildOptions */
const config = {
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  logLevel: 'info',
  // Not the Lambda's tsconfig.json: the bundle needs none of its options (no decorators or class fields) except
  // `strict`, which made the whole bundle strict mode; the banner keeps that. A tsconfig given here would also apply to
  // node_modules, adding a "use strict" to every module
  tsconfigRaw: {},
  banner: { js: '"use strict";' },
  define: { __COMMIT__: JSON.stringify(commit()) },

  ...(argv.dev ? devConfig : prodConfig),
};

esbuild.build(config);
