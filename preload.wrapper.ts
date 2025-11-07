// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { Script, constants } from 'node:vm';
import { ipcRenderer } from 'electron';

const srcPath = join(__dirname, 'preload.bundle.js');
const cachePath = join(__dirname, 'preload.bundle.cache');

let cachedData: Buffer | undefined;
try {
  if (!process.env.GENERATE_PRELOAD_CACHE) {
    cachedData = readFileSync(cachePath);
  }
} catch (error) {
  // No cache - no big deal
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

const source = readFileSync(srcPath);

window.preloadCompileStartTime = Date.now();

// `filename` is used for:
//
// - Annotating stack traces
// - Resolving dynamic `import()` calls
//
// When it is not an absolute path `import()` is resolved relative to the `cwd`.
//
// Since filename gets written into the `preload.bundle.cache` we need to use a
// path-independent value for reproducibility, and otherwise use full absolute
// path in the packaged app.
const filename = process.env.GENERATE_PRELOAD_CACHE
  ? 'preload.bundle.js'
  : srcPath;

// Create a custom require function that can handle ES modules
// by using dynamic import() for packages that are known to be ESM-only
const esmPackages = new Set([
  '@signalapp/libsignal-client',
  '@signalapp/libsignal-client/zkgroup',
]);

// Check if a module path is an ESM package or subpath
function isEsmPackage(modulePath: string): boolean {
  for (const pkg of esmPackages) {
    if (modulePath === pkg || modulePath.startsWith(`${pkg}/`)) {
      return true;
    }
  }
  return false;
}

// Cache for dynamically imported ES modules
const esmCache = new Map<string, unknown>();

// Custom require function that handles both CJS and ESM
function customRequire(modulePath: string): unknown {
  if (isEsmPackage(modulePath)) {
    // For ES modules, we need to use dynamic import
    // Since require is synchronous but import is async, we throw an error
    // that provides guidance on how to fix the code
    throw new Error(
      `Cannot require ES module "${modulePath}". ` +
        `Please use dynamic import() instead: ` +
        `const module = await import("${modulePath}");`
    );
  }
  return require(modulePath);
}

// Copy properties from original require
Object.setPrototypeOf(customRequire, require);
Object.assign(customRequire, require);

const script = new Script(
  `(function(require, __dirname){${source.toString()}})`,
  {
    filename,
    lineOffset: 0,
    cachedData,
    importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  }
);

const { cachedDataRejected } = script;

const fn = script.runInThisContext({
  filename,
  lineOffset: 0,
  columnOffset: 0,
  displayErrors: true,
  importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
});

// See `ts/scripts/generate-preload-cache.node.ts`
if (process.env.GENERATE_PRELOAD_CACHE) {
  // Use hottest cache possible in CI
  if (process.env.CI) {
    fn(customRequire, __dirname);
    window.startApp();
  }
  writeFileSync(cachePath, script.createCachedData());
  ipcRenderer.send('shutdown');
} else {
  fn(customRequire, __dirname);
  window.SignalCI?.setPreloadCacheHit(
    cachedData != null && !cachedDataRejected
  );
}

if (cachedDataRejected) {
  console.log('preload cache rejected');
} else {
  console.log('preload cache hit');
}
