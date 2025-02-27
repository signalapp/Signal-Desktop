// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { assert } from './utils/assert.mjs';
import packageJson from '../package.json' with { type: 'json' };

const NAME = packageJson.name;
const VERSION = packageJson.version;

const SUPPORT_CONFIG = new Set([
  'linux-x64',
  'linux-arm64',
  'windows',
  'macos-arm64',
  'macos-x64',
  'macos-universal',
]);

const RELEASE_DIR = join(import.meta.dirname, '..', 'release');

// TODO: DESKTOP-9836
const config = process.argv[2];
assert(config != null, 'Missing config arg');
if (!SUPPORT_CONFIG.has(config)) {
  throw new Error(`Invalid argument: ${config}`);
}

/** @type {string} */
let fileName;
/** @type {string} */
let platform;
/** @type {string} */
let arch;
if (config === 'linux-x64') {
  fileName = `${NAME}_${VERSION}_amd64.deb`;
  platform = 'linux';
  arch = 'x64';
} else if (config === 'linux-arm64') {
  fileName = `${NAME}_${VERSION}_arm64.deb`;
  platform = 'linux';
  arch = 'arm64';
} else if (config === 'windows') {
  fileName = `${NAME}-win-x64-${VERSION}.exe`;
  platform = 'windows';
  arch = 'x64';
} else if (config === 'macos-arm64') {
  fileName = `${NAME}-mac-arm64-${VERSION}.zip`;
  platform = 'macos';
  arch = 'arm64';
} else if (config === 'macos-x64') {
  fileName = `${NAME}-mac-x64-${VERSION}.zip`;
  platform = 'macos';
  arch = 'x64';
} else if (config === 'macos-universal') {
  fileName = `${NAME}-mac-universal-${VERSION}.dmg`;
  platform = 'macos';
  arch = 'universal';
} else {
  throw new Error(`Unsupported config: ${config}`);
}

const filePath = join(RELEASE_DIR, fileName);
const { size } = await stat(filePath);

console.log(`${platform} ${arch} release size: ${size}`);
