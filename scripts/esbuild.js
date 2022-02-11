// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const esbuild = require('esbuild');
const path = require('path');
const glob = require('glob');

const ROOT_DIR = path.join(__dirname, '..');

const watch = process.argv.some(argv => argv === '-w' || argv === '--watch');
const isProd = process.argv.some(argv => argv === '-prod' || argv === '--prod');

const nodeDefaults = {
  platform: 'node',
  target: 'node16',
  sourcemap: isProd ? false : 'inline',
  // Otherwise React components get renamed
  // See: https://github.com/evanw/esbuild/issues/1147
  keepNames: true,
  logLevel: 'info',
  watch,
};

const bundleDefaults = {
  ...nodeDefaults,
  bundle: true,
  external: [
    '@signalapp/signal-client',
    '@signalapp/signal-client/zkgroup',
    'backbone',
    'better-sqlite3',
    'fs-xattr',
    'fsevents',
    'got',
    'jquery',
    'mac-screen-capture-permissions',
    'node-fetch',
    'sass',
    'pino',
    'proxy-agent',
    'ringrtc',
    'sharp',
    'websocket',
    'electron',

    // Uses fast-glob and dynamic requires
    './preload_test',
  ],
};

// App, tests, and scripts
esbuild.build({
  ...nodeDefaults,
  format: 'cjs',
  mainFields: ['browser', 'main'],
  entryPoints: glob
    .sync('{app,ts}/**/*.{ts,tsx}', {
      nodir: true,
      root: ROOT_DIR,
    })
    .filter(file => !file.endsWith('.d.ts')),
  outdir: path.join(ROOT_DIR),
});

// Preload bundle
esbuild.build({
  ...bundleDefaults,
  mainFields: ['browser', 'main'],
  entryPoints: [path.join(ROOT_DIR, 'preload.js')],
  outfile: path.join(ROOT_DIR, 'preload.bundle.js'),
});

// HEIC worker
esbuild.build({
  ...bundleDefaults,
  entryPoints: [path.join(ROOT_DIR, 'ts', 'workers', 'heicConverterWorker.ts')],
  outfile: path.join(ROOT_DIR, 'ts', 'workers', 'heicConverter.bundle.js'),
});

// SQL worker
const libDir = path.join('..', '..', 'node_modules', 'better-sqlite3');
const bindingFile = path.join(
  libDir,
  'build',
  'Release',
  'better_sqlite3.node'
);

esbuild.build({
  ...nodeDefaults,
  bundle: true,

  plugins: [
    {
      name: 'bindings',
      setup(build) {
        build.onResolve({ filter: /^bindings$/ }, () => ({
          path: path.join(ROOT_DIR, 'ts', 'sql', 'mainWorkerBindings.ts'),
        }));

        build.onResolve({ filter: /^better_sqlite3\.node$/ }, () => ({
          path: bindingFile,
          external: true,
        }));
      },
    },
  ],

  entryPoints: [path.join(ROOT_DIR, 'ts', 'sql', 'mainWorker.ts')],
  outfile: path.join(ROOT_DIR, 'ts', 'sql', 'mainWorker.bundle.js'),
});
