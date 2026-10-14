/**
 * Bundles a Lambda (run from its folder, via its `npm run build` or `invoke:dry`): `src/index.ts` with everything it
 * imports, including lambda/shared/, into `dist/index.js`. Flag: `--dev` (source map, no minify).
 *
 * Lambdas import shared code as `@lambda/shared/<module>` (`alias`). lambda/shared/ has no node_modules, so its imports
 * resolve from the Lambda's (`nodePaths`), like the `paths` in tsconfig.lambda.json do for TypeScript.
 */
const { createRequire } = require('module');
const path = require('path');
const { parseArgs } = require('util');

const { values: argv } = parseArgs({
  options: { dev: { type: 'boolean' } },
});

// esbuild is the Lambda's devDependency
const esbuild = createRequire(path.resolve('package.json'))('esbuild');

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
  nodePaths: [path.resolve('node_modules')],
  alias: { '@lambda/shared': path.resolve(__dirname, '../src') },
  // Not the Lambda's tsconfig.json: its `paths` (for tsc) would make esbuild bundle packages as plain folders, e.g.
  // date-fns' CommonJS build instead of its ES modules. The bundle needs none of its options (no decorators or class
  // fields) except `strict`, which made the whole bundle strict mode; the banner keeps that. A tsconfig given here
  // would also apply to node_modules, adding a "use strict" to every module
  tsconfigRaw: {},
  banner: { js: '"use strict";' },

  ...(argv.dev ? devConfig : prodConfig),
};

esbuild.build(config);
