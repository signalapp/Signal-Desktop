// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const glob = require('glob');
const ROOT_DIR = path.join(__dirname, '..');
const BUNDLES_DIR = 'bundles';

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
  minify: isProd,
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
    // '@automerge/automerge',
    // '@automerge/automerge-wasm',
    // '@blocknote/react',
    // '@blocknote/core',
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

// console.log(wasmPlugin.setup + '');
// process.exit(1);

let wasmPlugin = {
  name: 'wasm',
  setup(build) {
    // Resolve ".wasm" files to a path with a namespace
    build.onResolve({ filter: /\.wasm$/ }, args => {
      // If this is the import inside the stub module, import the
      // binary itself. Put the path in the "wasm-binary" namespace
      // to tell our binary load callback to load the binary file.
      if (args.namespace === 'wasm-stub') {
        return {
          path: args.path,
          namespace: 'wasm-binary',
        };
      }

      // Otherwise, generate the JavaScript stub module for this
      // ".wasm" file. Put it in the "wasm-stub" namespace to tell
      // our stub load callback to fill it with JavaScript.
      //
      // Resolve relative paths to absolute paths here since this
      // resolve callback is given "resolveDir", the directory to
      // resolve imports against.
      if (args.resolveDir === '') {
        return; // Ignore unresolvable paths
      }
      return {
        path: path.isAbsolute(args.path)
          ? args.path
          : path.join(args.resolveDir, args.path),
        namespace: 'wasm-stub',
      };
    });

    // Virtual modules in the "wasm-stub" namespace are filled with
    // the JavaScript code for compiling the WebAssembly binary. The
    // binary itself is imported from a second virtual module.
    build.onLoad({ filter: /.*/, namespace: 'wasm-stub' }, async args => ({
      contents: `import wasm from ${JSON.stringify(args.path)}
        export default (imports) =>
          WebAssembly.instantiate(wasm, imports).then(
            result => result.instance.exports)`,
    }));

    // Virtual modules in the "wasm-binary" namespace contain the
    // actual bytes of the WebAssembly file. This uses esbuild's
    // built-in "binary" loader instead of manually embedding the
    // binary data inside JavaScript code ourselves.
    build.onLoad({ filter: /.*/, namespace: 'wasm-binary' }, async args => ({
      contents: await fs.promises.readFile(args.path),
      loader: 'binary',
    }));
  },
};

async function main() {
  await build({
    appConfig: {
      ...nodeDefaults,
      plugins: [wasmPlugin],
      format: 'cjs',
      mainFields: ['browser', 'main'],
      entryPoints: glob
        .sync('{app,ts}/**/*.{ts,tsx}', {
          nodir: true,
          root: ROOT_DIR,
        })
        .filter(file => !file.endsWith('.d.ts')),
      outdir: path.join(ROOT_DIR),
    },
    preloadConfig: {
      ...bundleDefaults,
      plugins: [wasmPlugin],
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
      plugins: [wasmPlugin],
      mainFields: ['browser', 'main'],
      entryPoints: [
        path.join(ROOT_DIR, 'ts', 'windows', 'about', 'app.tsx'),
        path.join(ROOT_DIR, 'ts', 'windows', 'debuglog', 'app.tsx'),
        path.join(ROOT_DIR, 'ts', 'windows', 'loading', 'start.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'permissions', 'app.tsx'),
        path.join(ROOT_DIR, 'ts', 'windows', 'screenShare', 'app.tsx'),
        path.join(ROOT_DIR, 'ts', 'windows', 'settings', 'app.tsx'),
      ],
    },
    preloadConfig: {
      ...sandboxedPreloadDefaults,
      plugins: [wasmPlugin],
      mainFields: ['main'],
      entryPoints: [
        path.join(ROOT_DIR, 'ts', 'windows', 'about', 'preload.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'debuglog', 'preload.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'loading', 'preload.ts'),
        path.join(ROOT_DIR, 'ts', 'windows', 'permissions', 'preload.ts'),
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
