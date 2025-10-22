// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const esbuild = require('esbuild');
const path = require('node:path');
const fs = require('node:fs');
const fastGlob = require('fast-glob');

const ROOT_DIR = path.join(__dirname, '..');
const BUNDLES_DIR = 'bundles';
const NODE_MODULES_DIR = path.join(ROOT_DIR, 'node_modules');

const watch = process.argv.some(argv => argv === '-w' || argv === '--watch');
const isProd = process.argv.some(argv => argv === '-prod' || argv === '--prod');
const noBundle = process.argv.some(argv => argv === '--no-bundle');
const noScripts = process.argv.some(argv => argv === '--no-scripts');

const nodeDefaults = {
  platform: 'node',
  target: 'es2023',
  // Disabled even in dev because the debugger is broken
  sourcemap: false,
  // Otherwise React components get renamed
  // See: https://github.com/evanw/esbuild/issues/1147
  keepNames: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'resolve-ts',
      setup(b) {
        b.onResolve({ filter: /\.js$/ }, args => {
          if (!args.path.startsWith('.')) {
            return undefined;
          }

          const targetPath = path.join(args.resolveDir, args.path);
          if (targetPath.startsWith(NODE_MODULES_DIR)) {
            return undefined;
          }
          const tsPath = targetPath.replace(/\.js$/, '.ts');
          const tsxPath = targetPath.replace(/\.js$/, '.tsx');
          if (fs.existsSync(tsPath)) {
            return { path: tsPath };
          }
          if (fs.existsSync(tsxPath)) {
            return { path: tsxPath };
          }

          return undefined;
        });
      },
    },
  ],
};

const bundleDefaults = {
  ...nodeDefaults,
  define: {
    'process.env.NODE_ENV': isProd ? '"production"' : '"development"',
  },
  bundle: true,
  minify: isProd,
  external: [
    // Native libraries
    '@signalapp/libsignal-client',
    '@signalapp/libsignal-client/zkgroup',
    '@signalapp/ringrtc',
    '@signalapp/sqlcipher',
    '@signalapp/mute-state-change',
    '@indutny/mac-screen-share',
    'electron',
    'fs-xattr',
    'fsevents',
    'mac-screen-capture-permissions',
    'sass',
    'bufferutil',
    'utf-8-validate',

    // Things that don't bundle well
    'got',
    'node-fetch',
    'pino',
    'proxy-agent',
    'websocket',

    // Large libraries (3.7mb total)
    // See: https://esbuild.github.io/api/#analyze
    'emoji-datasource',
    'fabric',
    'google-libphonenumber',
    'moment',
    'quill',

    // Imported, but not used in production builds
    'mocha',

    // Uses fast-glob and dynamic requires
    './preload_test.preload.js',
  ],
};

const sandboxedPreloadDefaults = {
  ...nodeDefaults,
  define: {
    'process.env.NODE_ENV': isProd ? '"production"' : '"development"',
  },
  external: ['electron'],
  bundle: true,
  minify: isProd,
};

const sandboxedBrowserDefaults = {
  ...sandboxedPreloadDefaults,
  chunkNames: 'chunks/[name]-[hash]',
  format: 'esm',
  outdir: path.join(ROOT_DIR, BUNDLES_DIR),
  platform: 'browser',
  splitting: true,
};

async function build({ appConfig, preloadConfig }) {
  let app;
  let preload;

  if (!noScripts) {
    app = await esbuild.context(appConfig);
  }
  if (!noBundle) {
    preload = await esbuild.context(preloadConfig);
  }

  if (watch) {
    await Promise.all([app && app.watch(), preload && preload.watch()]);
  } else {
    await Promise.all([app && app.rebuild(), preload && preload.rebuild()]);

    if (app) {
      await app.dispose();
    }
    if (preload) {
      await preload.dispose();
    }
  }
}

async function main() {
  await build({
    appConfig: {
      ...nodeDefaults,
      format: 'cjs',
      mainFields: ['browser', 'main'],
      entryPoints: [
        'preload.wrapper.ts',
        ...fastGlob
          .sync('{app,ts,build}/**/*.{ts,tsx}', {
            onlyFiles: true,
            cwd: ROOT_DIR,
          })
          .filter(file => !file.endsWith('.d.ts')),
      ],
      outdir: path.join(ROOT_DIR),
    },
    preloadConfig: {
      ...bundleDefaults,
      mainFields: ['browser', 'main'],
      entryPoints: [
        path.join(ROOT_DIR, 'ts', 'windows', 'main', 'preload.preload.ts'),
      ],
      outfile: path.join(ROOT_DIR, 'preload.bundle.js'),
    },
  });
}

async function sandboxedEnv() {
  await build({
    appConfig: {
      ...sandboxedBrowserDefaults,
      mainFields: ['browser', 'main'],
      entryPoints: [
        path.join(ROOT_DIR, 'ts', 'windows', 'about', 'app.dom.tsx'),
        path.join(ROOT_DIR, 'ts', 'windows', 'debuglog', 'app.dom.tsx'),
        path.join(ROOT_DIR, 'ts', 'windows', 'loading', 'start.dom.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'permissions', 'app.dom.tsx'),
        path.join(ROOT_DIR, 'ts', 'windows', 'screenShare', 'app.dom.tsx'),
        path.join(
          ROOT_DIR,
          'ts',
          'windows',
          'calling-tools',
          'webrtc_internals.dom.ts'
        ),
      ],
    },
    preloadConfig: {
      ...sandboxedPreloadDefaults,
      mainFields: ['browser', 'main'],
      entryPoints: [
        path.join(ROOT_DIR, 'ts', 'windows', 'about', 'preload.preload.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'debuglog', 'preload.preload.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'loading', 'preload.preload.ts'),
        path.join(
          ROOT_DIR,
          'ts',
          'windows',
          'permissions',
          'preload.preload.ts'
        ),
        path.join(
          ROOT_DIR,
          'ts',
          'windows',
          'calling-tools',
          'preload.preload.ts'
        ),
        path.join(
          ROOT_DIR,
          'ts',
          'windows',
          'screenShare',
          'preload.preload.ts'
        ),
      ],
      format: 'cjs',
      outdir: 'bundles',
    },
  });
}

Promise.all([main(), sandboxedEnv()]).catch(error => {
  console.error(error.stack);
  process.exit(1);
});
