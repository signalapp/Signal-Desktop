// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import { packageJson } from '../util/packageJson.node.ts';

const NAME = packageJson.name;
const VERSION = packageJson.version;

const SUPPORT_CONFIG = new Set([
  'linux',
  'windows',
  'macos-arm64',
  'macos-x64',
  'macos-universal',
]);

const RELEASE_DIR = join(__dirname, '..', '..', 'release');

// TODO: DESKTOP-9836
async function main(): Promise<void> {
  // oxlint-disable-next-line typescript/no-non-null-assertion
  const config = process.argv[2]!;
  if (!SUPPORT_CONFIG.has(config)) {
    throw new Error(`Invalid argument: ${config}`);
  }

  let fileName: string;
  let platform: string;
  let arch: string;
  if (config === 'linux') {
    fileName = `${NAME}_${VERSION}_amd64.deb`;
    platform = 'linux';
    arch = 'x64';
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
}

// oxlint-disable-next-line promise/prefer-await-to-then
main().catch(err => {
  console.error('Failed', err);
  process.exit(1);
});
