// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const esbuild = require('esbuild');
const path = require('path');
const fastGlob = require('fast-glob');

const ROOT_DIR = path.join(__dirname, '..');
const BUNDLES_DIR = 'bundles';

const watch = process.argv.some(argv => argv === '-w' || argv === '--watch');
const isProd = process.argv.some(argv => argv === '-prod' || argv === '--prod');

const nodeDefaults = {
  platform: 'node',
  target: 'es2023',
  // Disabled even in dev because the debugger is broken
  sourcemap: false,
  // Otherwise React components get renamed
  // See: https://github.com/evanw/esbuild/issues/1147
  keepNames: true,
  logLevel: 'info',
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
    '@signalapp/better-sqlite3',
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
    'jquery',
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

    // Uses fast-glob and dynamic requires
    './preload_test',
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
  const app = await esbuild.context(appConfig);
  const preload = await esbuild.context(preloadConfig);

  if (watch) {
    await Promise.all([app.watch(), preload.watch()]);
  } else {
    await Promise.all([app.rebuild(), preload.rebuild()]);

    await app.dispose();
    await preload.dispose();
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
          .sync('{app,ts}/**/*.{ts,tsx}', {
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
      entryPoints: [path.join(ROOT_DIR, 'ts', 'windows', 'main', 'preload.ts')],
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
        path.join(ROOT_DIR, 'ts', 'windows', 'about', 'app.tsx'),
        path.join(ROOT_DIR, 'ts', 'windows', 'debuglog', 'app.tsx'),
        path.join(ROOT_DIR, 'ts', 'windows', 'loading', 'start.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'permissions', 'app.tsx'),
        path.join(ROOT_DIR, 'ts', 'windows', 'screenShare', 'app.tsx'),
        path.join(ROOT_DIR, 'ts', 'windows', 'settings', 'app.tsx'),
        path.join(
          ROOT_DIR,
          'ts',
          'windows',
          'calling-tools',
          'webrtc_internals.ts'
        ),
      ],
    },
    preloadConfig: {
      ...sandboxedPreloadDefaults,
      mainFields: ['main'],
      entryPoints: [
        path.join(ROOT_DIR, 'ts', 'windows', 'about', 'preload.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'debuglog', 'preload.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'loading', 'preload.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'permissions', 'preload.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'calling-tools', 'preload.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'screenShare', 'preload.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'settings', 'preload.ts'),
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
