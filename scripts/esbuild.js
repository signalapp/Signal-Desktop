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
  target: 'esnext',
  sourcemap: isProd ? false : 'inline',
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
  external: [
    // Native libraries
    '@signalapp/libsignal-client',
    '@signalapp/libsignal-client/zkgroup',
    '@signalapp/ringrtc',
    '@signalapp/better-sqlite3',
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

async function main() {
  // App, tests, and scripts
  const app = await esbuild.context({
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
  const bundle = await esbuild.context({
    ...bundleDefaults,
    mainFields: ['browser', 'main'],
    entryPoints: [path.join(ROOT_DIR, 'ts', 'windows', 'main', 'preload.ts')],
    outfile: path.join(ROOT_DIR, 'preload.bundle.js'),
  });

  if (watch) {
    await Promise.all([app.watch(), bundle.watch()]);
  } else {
    await Promise.all([app.rebuild(), bundle.rebuild()]);

    await app.dispose();
    await bundle.dispose();
  }
}

main().catch(error => {
  console.error(error.stack);
  process.exit(1);
});

// About bundle
esbuild.build({
  ...bundleDefaults,
  mainFields: ['browser', 'main'],
  entryPoints: [path.join(ROOT_DIR, 'ts', 'windows', 'about', 'app.tsx')],
  outfile: path.join(ROOT_DIR, 'about.browser.bundle.js'),
});

esbuild.build({
  ...bundleDefaults,
  mainFields: ['browser', 'main'],
  entryPoints: [path.join(ROOT_DIR, 'ts', 'windows', 'about', 'preload.ts')],
  outfile: path.join(ROOT_DIR, 'about.preload.bundle.js'),
});
