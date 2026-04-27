// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { notarize } from '@electron/notarize';
import { assert } from './utils/assert.mjs';
import packageJson from '../package.json' with { type: 'json' };

/** @import { BuildResult } from 'electron-builder' */

/**
 * @param {BuildResult} result
 * @returns {Promise<void>}
 */
export async function afterAllArtifactBuild({
  platformToTargets,
  artifactPaths,
}) {
  const platforms = Array.from(platformToTargets.keys()).map(
    platform => platform.name
  );
  if (platforms.length !== 1) {
    console.log(
      `notarize: Skipping, too many platforms ${platforms.join(', ')}`
    );
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
    console.log(
      `notarize: Skipping, too many dmgs ${artifactsToStaple.join(', ')}`
    );
    return;
  }

  const dmgPath = artifactsToStaple[0];
  assert(dmgPath != null, 'Missing dmgPath');
  console.log(`Notarizing dmg: ${dmgPath}`);

  await notarize({
    appBundleId,
    appPath: dmgPath,
    appleId,
    appleIdPassword,
    teamId,
  });
}
