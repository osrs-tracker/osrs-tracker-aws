const argv = require('minimist')(process.argv.slice(2));

const esbuild = require('esbuild');

/** @type esbuild.BuildOptions */
const devConfig = {
  sourcemap: 'linked',
};

/** @type esbuild.BuildOptions */
const prodConfig = {
  minify: true,
};

/** @type esbuild.BuildOptions */
const config = {
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  logLevel: 'info',

  plugins: [],

  ...(argv.dev ? devConfig : prodConfig),
};

if (argv.run) config.plugins.push(require('@es-exec/esbuild-plugin-start').default({ script: 'node dist/index.js' }));

if (argv.watch) {
  (async () => {
    const ctx = await esbuild.context(config);
    await ctx.watch();
  })();
} else esbuild.build(config);
