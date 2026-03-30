// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'rolldown';

const external = [
  // Native libraries
  '@signalapp/libsignal-client',
  /^@signalapp\/libsignal-client\/.*/,
  '@signalapp/ringrtc',
  '@signalapp/sqlcipher',
  '@signalapp/mute-state-change',
  '@signalapp/windows-ucv',
  '@indutny/simple-windows-notifications',
  '@indutny/mac-screen-share',
  '@napi-rs/canvas',
  'electron',
  'fs-xattr',
  'fsevents',
  'mac-screen-capture-permissions',
  'sass',

  // Things that don't bundle well
  'got',
  'node-fetch',
  'pino',
  'proxy-agent',

  // Large libraries (3.7mb total)
  // See: https://esbuild.github.io/api/#analyze
  'emoji-datasource',
  'google-libphonenumber',

  // Imported, but not used in production builds
  'mocha',

  // Electron's internal module
  'original-fs',

  // Uses fast-glob and dynamic requires
  './preload_test.preload.ts',
];

const isProd = process.argv.some(arg => arg === '--minify');

const transform = {
  define: {
    'process.env.NODE_ENV': isProd ? '"production"' : '"development"',
    'process.env.IS_BUNDLED': 'true',
  },
};

const nonIsolated = {
  // Preloads
  'preload/wrapper': 'preload.wrapper.ts',
  'preload/main': 'ts/windows/main/preload.preload.ts',

  // Workers
  'workers/sql': 'ts/sql/mainWorker.node.ts',
  'workers/heic': 'ts/workers/heicConverterWorker.node.ts',
};

const contextIsolated = {
  // Preload
  'preload/about': 'ts/windows/about/preload.preload.ts',
  'preload/calldiagnostic': 'ts/windows/calldiagnostic/preload.preload.ts',
  'preload/debuglog': 'ts/windows/debuglog/preload.preload.ts',
  'preload/permissions': 'ts/windows/permissions/preload.preload.ts',
  'preload/screenShare': 'ts/windows/screenShare/preload.preload.ts',
  'preload/sticker-creator': 'ts/windows/sticker-creator/preload.preload.ts',

  // DOM
  'dom/about': 'ts/windows/about/app.dom.tsx',
  'dom/calldiagnostic': 'ts/windows/calldiagnostic/app.dom.tsx',
  'dom/debuglog': 'ts/windows/debuglog/app.dom.tsx',
  'dom/loading': 'ts/windows/loading/start.dom.ts',
  'dom/permissions': 'ts/windows/permissions/app.dom.tsx',
  'dom/screenShare': 'ts/windows/screenShare/app.dom.tsx',
};

const defaults = {
  transform,
  external,
  output: {
    format: 'cjs',
    dir: 'bundles',
    exports: 'named',
    chunkFileNames: 'chunks/[name]-[hash].js',
    generatedCode: {
      symbols: false,
    },
  },
};

if (isProd) {
  try {
    rmSync(join(__dirname, 'bundles'), { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

export default defineConfig([
  {
    ...defaults,
    input: nonIsolated,
  },
  // Each context isolated bundle has to be separate from the rest since
  // they cannot use `require()`
  ...Object.entries(contextIsolated).map(([key, value]) => {
    return {
      ...defaults,
      external: ['electron'],
      platform: 'browser',
      input: { [key]: value },
      output: {
        ...defaults.output,
        codeSplitting: false,
      },
    };
  }),
  {
    ...defaults,

    // Main
    input: {
      main: 'app/main.main.ts',
      config: 'app/config.main.js',
    },

    // Do not override process.env.NODE_ENV in main process
    transform: {
      define: {
        'process.env.IS_BUNDLED': 'true',
      },
    },
  },
]);
