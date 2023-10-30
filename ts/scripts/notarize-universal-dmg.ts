// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BuildResult } from 'electron-builder';

import { notarize } from '@electron/notarize';

import * as packageJson from '../../package.json';

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

  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) {
    console.warn(
      'teamId must be provided in environment variable APPLE_TEAM_ID'
    );
    return;
  }

  const artifactsToStaple = artifactPaths.filter(artifactPath =>
    /^.*mac-universal.*\.dmg$/.test(artifactPath)
  );
  if (artifactsToStaple.length !== 1) {
    console.log(`notarize: Skipping, too many dmgs ${artifactsToStaple}`);
    return;
  }

  const [dmgPath] = artifactsToStaple;
  console.log(`Notarizing dmg: ${dmgPath}`);

  await notarize({
    appBundleId,
    appPath: dmgPath,
    appleId,
    appleIdPassword,
    teamId,
  });
}
