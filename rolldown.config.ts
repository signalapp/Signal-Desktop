// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig } from 'rolldown';
import { transform } from 'oxc-transform';

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

  // Large libraries (3.7mb total)
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

const sandboxPreload = {
  // Preload
  'preload/about': 'ts/windows/about/preload.preload.ts',
  'preload/calldiagnostic': 'ts/windows/calldiagnostic/preload.preload.ts',
  'preload/debuglog': 'ts/windows/debuglog/preload.preload.ts',
  'preload/permissions': 'ts/windows/permissions/preload.preload.ts',
  'preload/screenShare': 'ts/windows/screenShare/preload.preload.ts',
  'preload/sticker-creator': 'ts/windows/sticker-creator/preload.preload.ts',
};

const sandboxDOM = {
  'dom/about': 'ts/windows/about/app.dom.tsx',
  'dom/calldiagnostic': 'ts/windows/calldiagnostic/app.dom.tsx',
  'dom/debuglog': 'ts/windows/debuglog/app.dom.tsx',
  'dom/loading': 'ts/windows/loading/start.dom.ts',
  'dom/permissions': 'ts/windows/permissions/app.dom.tsx',
  'dom/screenShare': 'ts/windows/screenShare/app.dom.tsx',
};

const defaults = {
  transform: {
    define: {
      'process.env.IS_BUNDLED': 'true',
      ...(isProd
        ? {
            __REACT_DEVTOOLS_GLOBAL_HOOK__: 'undefined',
          }
        : {}),
    },
  },
  plugins: [
    {
      name: 'NODE_ENV',
      transform(code, id) {
        if (id.endsWith('.json')) {
          return;
        }

        const path = relative(__dirname, id);
        if (path.startsWith('app')) {
          return;
        }

        return transform(id, code, {
          define: {
            'process.env.NODE_ENV': isProd ? '"production"' : '"development"',
          },
          sourcemap: !isProd,
        });
      },
    },
  ],
  external,
  output: {
    format: 'cjs',
    dir: 'bundles',
    exports: 'named',
    chunkFileNames: 'chunks/[name]-[hash].js',
    generatedCode: {
      symbols: false,
    },
    sourcemap: !isProd,
    sourcemapBaseUrl: 'bundles:///',
    postBanner: ({ fileName }) => {
      // See preload.wrapper.ts
      if (fileName === 'preload/main.js') {
        return '(function(require, __dirname, exports){';
      }

      return '';
    },
    postFooter: ({ fileName }) => {
      const lines = new Array<string>();

      // See preload.wrapper.ts
      if (fileName === 'preload/main.js') {
        lines.push('})');
      }

      lines.push(`//# sourceURL=bundles:///${fileName}`);

      return lines.join('\n');
    },
  },
  watch: {
    clearScreen: false,
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
  // Each sandboxed bundle has to be separate from the rest since
  // they cannot use `require()`
  ...Object.entries(sandboxPreload).map(([key, value]) => {
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
    external: ['electron'],
    platform: 'browser',
    input: sandboxDOM,
    output: {
      ...defaults.output,
      format: 'es',
    },
  },
  {
    ...defaults,

    input: {
      // Main
      main: 'app/main.main.ts',
      config: 'app/config.main.js',

      // Preloads
      'preload/wrapper': 'preload.wrapper.ts',
      'preload/main': 'ts/windows/main/preload.preload.ts',

      // Workers
      'workers/sql': 'ts/sql/mainWorker.node.ts',
      'workers/heic': 'ts/workers/heicConverterWorker.node.ts',
    },
  },

  // Voice Note Worker
  {
    input: 'components/webaudiorecorder/lib/WebAudioRecorderMp3.js',
    transform: {
      define: {
        process: 'undefined',
        require: 'undefined',
        eval: 'undefined',
      },
      inject: {
        Mp3LameEncoder: '../../mp3lameencoder/lib/Mp3LameEncoder.js',
      },
    },
    output: {
      file: 'bundles/workers/WebAudioRecorderMp3.js',
      exports: 'named',
      generatedCode: {
        symbols: false,
      },
    },
    watch: {
      clearScreen: false,
    },
  },
]);
