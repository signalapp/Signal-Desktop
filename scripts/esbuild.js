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
  target: 'es2020',
  sourcemap: isProd ? false : 'inline',
  // Otherwise React components get renamed
  // See: https://github.com/evanw/esbuild/issues/1147
  keepNames: true,
  logLevel: 'info',
  watch,
};

const bundleDefaults = {
  ...nodeDefaults,
  define: {
    'process.env.NODE_ENV': isProd ? '"production"' : '"development"',
  },
  bundle: true,
  external: [
    // Native libraries
    '@signalapp/libsignal-client',
    '@signalapp/libsignal-client/zkgroup',
    'better-sqlite3',
    'electron',
    'fs-xattr',
    'fsevents',
    'mac-screen-capture-permissions',
    'ringrtc',
    'sass',
    'sharp',
    'websocket',

    // Things that don't bundle well
    'backbone',
    'got',
    'jquery',
    'node-fetch',
    'pino',
    'proxy-agent',

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

// App, tests, and scripts
esbuild.build({
  ...nodeDefaults,
  format: 'cjs',
  mainFields: ['browser', 'main'],
  entryPoints: glob
    .sync('{app,ts,sticker-creator}/**/*.{ts,tsx}', {
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
  entryPoints: [path.join(ROOT_DIR, 'ts', 'windows', 'main', 'preload.ts')],
  outfile: path.join(ROOT_DIR, 'preload.bundle.js'),
});
