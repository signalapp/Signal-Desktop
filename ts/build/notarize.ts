import { join, resolve } from 'path';
import { readdir as readdirCallback } from 'fs';

import pify from 'pify';

import { notarize } from 'electron-notarize';

// @ts-ignore
import * as packageJson from '../../package.json';

const readdir = pify(readdirCallback);

/* tslint:disable:no-console */

// tslint:disable-next-line:no-floating-promises
go();

async function go() {
  if (process.platform !== 'darwin') {
    console.log('notarize: Skipping, not on macOS');

    return;
  }

  const appPath = await findDMG();
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
  console.log(`  file: ${appPath}`);
  console.log(`  primaryBundleId: ${appBundleId}`);
  console.log(`  username: ${appleId}`);

  await notarize({
    appBundleId,
    appPath,
    appleId,
    appleIdPassword,
  });
}

const IS_DMG = /\.dmg$/;
async function findDMG(): Promise<string> {
  const releaseDir = resolve('release');
  const files: Array<string> = await readdir(releaseDir);

  const max = files.length;
  for (let i = 0; i < max; i += 1) {
    const file = files[i];
    const fullPath = join(releaseDir, file);

    if (IS_DMG.test(file)) {
      return fullPath;
    }
  }

  throw new Error("No suitable file found in 'release' folder!");
}
