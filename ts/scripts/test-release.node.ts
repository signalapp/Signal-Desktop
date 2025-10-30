// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import asar from '@electron/asar';
import assert from 'node:assert';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, cp } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { _electron as electron } from 'playwright';

import { productName, name } from '../util/packageJson.node.js';
import { gracefulRmRecursive } from '../util/gracefulFs.node.js';
import { consoleLogger } from '../util/consoleLogger.std.js';

const ENVIRONMENT = 'production';
const RELEASE_DIR = join(__dirname, '..', '..', 'release');

let archive: string;
let exe: string;
if (process.platform === 'darwin') {
  archive = join(
    'mac-arm64',
    `${productName}.app`,
    'Contents',
    'Resources',
    'app.asar'
  );
  exe = join(
    'mac-arm64',
    `${productName}.app`,
    'Contents',
    'MacOS',
    productName
  );
} else if (process.platform === 'win32') {
  archive = join('win-unpacked', 'resources', 'app.asar');
  exe = join('win-unpacked', `${productName}.exe`);
} else if (process.platform === 'linux') {
  archive = join('linux-unpacked', 'resources', 'app.asar');
  exe = join('linux-unpacked', name);
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
const main = async () => {
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
    assert.strictEqual(await window.title(), productName);

    await app.close();
  } finally {
    await gracefulRmRecursive(consoleLogger, tmpFolder);
  }
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
