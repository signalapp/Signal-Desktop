// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BuildResult } from 'electron-builder';

import { stapleApp } from 'electron-notarize';

import * as packageJson from '../../package.json';

/* eslint-disable no-console */

export async function afterAllArtifactBuild({
  platformToTargets,
  artifactPaths,
}: BuildResult): Promise<void> {
  const platforms = Array.from(platformToTargets.keys()).map(
    platform => platform.name
  );
  if (platforms.length !== 1) {
    console.log(`notarize: Skipping, too many platforms ${platforms}`);
    return;
  }

  if (platforms[0] !== 'mac') {
    console.log(`notarize: Skipping, platform is ${platforms[0]}`);
    return;
  }

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

  const artifactsToStaple = artifactPaths.filter(artifactPath =>
    /\.(zip|dmg)$/.test(artifactPath)
  );

  for (const artifactPath of artifactsToStaple) {
    console.log(`Stapling notariation for: ${artifactPath}`);
    // eslint-disable-next-line no-await-in-loop
    await stapleApp({
      appPath: artifactPath,
    });
  }
}
