// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import path from 'path';
import type { AfterPackContext } from 'electron-builder';

import { notarize } from '@electron/notarize';

import * as packageJson from '../../package.json';

export async function afterSign({
  appOutDir,
  packager,
  electronPlatformName,
}: AfterPackContext): Promise<void> {
  if (electronPlatformName !== 'darwin') {
    console.log('notarize: Skipping, not on macOS');
    return;
  }

  const { productFilename } = packager.appInfo;

  const appPath = path.join(appOutDir, `${productFilename}.app`);

  const appBundleId = packageJson.build.appId;
  if (!appBundleId) {
    throw new Error(
      'appBundleId must be provided in package.json: build.appId'
    );
  }

  const appleId = process.env.APPLE_USERNAME;
  if (!appleId) {
    console.warn(
      'appleId must be provided in environment variable APPLE_USERNAME'
    );
    return;
  }

  const appleIdPassword = process.env.APPLE_PASSWORD;
  if (!appleIdPassword) {
    console.warn(
      'appleIdPassword must be provided in environment variable APPLE_PASSWORD'
    );
    return;
  }

  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) {
    console.warn(
      'teamId must be provided in environment variable APPLE_TEAM_ID'
    );
    return;
  }

  console.log('Notarizing with...');
  console.log(`  primaryBundleId: ${appBundleId}`);
  console.log(`  username: ${appleId}`);
  console.log(`  file: ${appPath}`);

  await notarize({
    appBundleId,
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
}
