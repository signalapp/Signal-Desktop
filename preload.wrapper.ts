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
    fn(require, __dirname);
    window.startApp();
  }
  writeFileSync(cachePath, script.createCachedData());
  ipcRenderer.send('shutdown');
} else {
  fn(require, __dirname);
  window.SignalCI?.setPreloadCacheHit(
    cachedData != null && !cachedDataRejected
  );
}

if (cachedDataRejected) {
  console.log('preload cache rejected');
} else {
  console.log('preload cache hit');
}
