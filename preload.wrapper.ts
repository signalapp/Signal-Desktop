// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Based on:
// https://github.com/zertosh/v8-compile-cache/blob/b6bc035d337fbda0e6e3ec7936499048fc9deafc/v8-compile-cache.js

import { Module } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Script, constants } from 'node:vm';
import { ipcRenderer } from 'electron';

const srcPath = join(__dirname, 'preload.bundle.js');
const cachePath = join(__dirname, 'preload.bundle.cache');

let cachedData: Buffer | undefined;
try {
  cachedData = readFileSync(cachePath);
} catch (error) {
  // No cache - no big deal
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

let script: Script | undefined;

function compile(
  filename: string,
  content: string
): (..._args: Array<unknown>) => void {
  // https://github.com/nodejs/node/blob/v7.5.0/lib/module.js#L511

  // create wrapper function
  const wrapper = Module.wrap(content);

  script = new Script(wrapper, {
    filename,
    lineOffset: 0,
    cachedData,
    importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  });

  const compiledWrapper = script.runInThisContext({
    filename,
    lineOffset: 0,
    columnOffset: 0,
    displayErrors: true,
    importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  });

  return compiledWrapper;
}

const ModuleInternals = Module as unknown as {
  prototype: {
    _compile(
      this: typeof ModuleInternals,
      content: string,
      filename: string
    ): unknown;
  };
  require(id: string): unknown;
  exports: unknown;
  _resolveFilename(
    request: unknown,
    mod: unknown,
    _: false,
    options: unknown
  ): unknown;
  _resolveLookupPaths(request: unknown, mod: unknown, _: true): unknown;
  _cache: unknown;
  _extensions: unknown;
};

if (cachedData || process.env.GENERATE_PRELOAD_CACHE) {
  const previousModuleCompile = ModuleInternals.prototype._compile;
  ModuleInternals.prototype._compile = function _compile(
    content: string,
    filename: string
  ) {
    if (filename !== srcPath) {
      throw new Error(`Unexpected filename: ${filename}`);
    }

    // Immediately restore
    ModuleInternals.prototype._compile = previousModuleCompile;

    const require = (id: string) => {
      return this.require(id);
    };

    // https://github.com/nodejs/node/blob/v10.15.3/lib/internal/modules/cjs/helpers.js#L28
    const resolve = (request: unknown, options: unknown) => {
      return ModuleInternals._resolveFilename(request, this, false, options);
    };
    require.resolve = resolve;

    resolve.paths = (request: unknown) => {
      return ModuleInternals._resolveLookupPaths(request, this, true);
    };

    require.main = process.mainModule;

    // Enable support to add extra extension types
    require.extensions = ModuleInternals._extensions;
    require.cache = ModuleInternals._cache;

    const dir = dirname(filename);

    const compiledWrapper = compile(filename, content);

    // We skip the debugger setup because by the time we run, node has already
    // done that itself.

    // `Buffer` is included for Electron.
    // See https://github.com/zertosh/v8-compile-cache/pull/10#issuecomment-518042543
    const args = [
      this.exports,
      require,
      this,
      filename,
      dir,
      process,
      global,
      Buffer,
    ];
    return compiledWrapper.apply(this.exports, args);
  };
}

// eslint-disable-next-line import/no-dynamic-require
require(srcPath);

// See `ts/scripts/generate-preload-cache.ts`
if (script && process.env.GENERATE_PRELOAD_CACHE) {
  writeFileSync(cachePath, script.createCachedData());
  ipcRenderer.send('shutdown');
}
