// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join, resolve } from 'path';
import { readdir as readdirCallback } from 'fs';

import pify from 'pify';

import { notarize } from 'electron-notarize';

import * as packageJson from '../../package.json';

const readdir = pify(readdirCallback);

/* eslint-disable no-console */

go().catch(error => {
  console.error(error.stack);

  process.exit(1);
});

async function go() {
  if (process.platform !== 'darwin') {
    console.log('notarize: Skipping, not on macOS');

    return;
  }

  const appPaths = await findDMGs();
  const appBundleId = packageJson.build.appId;
  if (!appBundleId) {
    throw new Error(
      'appBundleId must be provided in package.json: build.appId'
    );
  }

  const appleId = process.env.APPLE_USERNAME;
  if (!appleId) {
    throw new Error(
      'appleId must be provided in environment variable APPLE_USERNAME'
    );
  }

  const appleIdPassword = process.env.APPLE_PASSWORD;
  if (!appleIdPassword) {
    throw new Error(
      'appleIdPassword must be provided in environment variable APPLE_PASSWORD'
    );
  }

  console.log('Notarizing with...');
  console.log(`  primaryBundleId: ${appBundleId}`);
  console.log(`  username: ${appleId}`);

  for (const appPath of appPaths) {
    console.log(`  file: ${appPath}`);

    // eslint-disable-next-line no-await-in-loop
    await notarize({
      appBundleId,
      appPath,
      appleId,
      appleIdPassword,
    });
  }
}

const IS_DMG = /\.dmg$/;
async function findDMGs(): Promise<Array<string>> {
  const releaseDir = resolve('release');
  const files: Array<string> = await readdir(releaseDir);

  const max = files.length;
  const results = new Array<string>();
  for (let i = 0; i < max; i += 1) {
    const file = files[i];
    const fullPath = join(releaseDir, file);

    if (IS_DMG.test(file)) {
      results.push(fullPath);
    }
  }

  if (results.length === 0) {
    throw new Error("No suitable files found in 'release' folder!");
  }

  return results;
}
