// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import asar from '@electron/asar';
import assert from 'node:assert';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { _electron as electron } from 'playwright';
import packageJson from '../package.json' with { type: 'json' };

const ENVIRONMENT = 'production';
const RELEASE_DIR = join(import.meta.dirname, '..', 'release');

/** @type {string} */
let archive;
/** @type {string} */
let exe;
if (process.platform === 'darwin') {
  archive = join(
    'mac-arm64',
    `${packageJson.productName}.app`,
    'Contents',
    'Resources',
    'app.asar'
  );
  exe = join(
    'mac-arm64',
    `${packageJson.productName}.app`,
    'Contents',
    'MacOS',
    packageJson.productName
  );
} else if (process.platform === 'win32') {
  archive = join('win-unpacked', 'resources', 'app.asar');
  exe = join('win-unpacked', `${packageJson.productName}.exe`);
} else if (process.platform === 'linux') {
  archive = join('linux-unpacked', 'resources', 'app.asar');
  exe = join('linux-unpacked', packageJson.name);
} else {
  throw new Error(`Unsupported platform: ${process.platform}`);
}

const files = [
  join('config', 'default.json'),
  join('config', `${ENVIRONMENT}.json`),
  join('config', `local-${ENVIRONMENT}.json`),
];

for (const fileName of files) {
  console.log(`Checking that ${fileName} exists in asar ${archive}`);
  try {
    asar.statFile(join(RELEASE_DIR, archive), fileName);
  } catch (e) {
    console.log(e);
    throw new Error(`Missing file ${fileName}`);
  }
}

// A simple test to verify a visible window is opened with a title

const tmpFolder = await mkdtemp(join(tmpdir(), 'test-release'));
const tmpApp = join(tmpFolder, 'Signal');

try {
  await cp(RELEASE_DIR, tmpApp, {
    recursive: true,
    mode: fsConstants.COPYFILE_FICLONE,
  });

  const executablePath = join(tmpApp, exe);
  console.log('Starting path', executablePath);
  const app = await electron.launch({
    executablePath,
    locale: 'en',
    cwd: tmpApp,
  });

  console.log('Waiting for a first window');
  const window = await app.firstWindow();

  console.log('Waiting for app to fully load');
  await window.waitForSelector(
    '.App, .app-loading-screen:has-text("Optimizing")'
  );

  console.log('Checking window title');
  assert.strictEqual(await window.title(), packageJson.productName);

  await app.close();
} finally {
  await rm(tmpFolder, {
    recursive: true,
    force: true,
    maxRetries: 100,
  });
}
