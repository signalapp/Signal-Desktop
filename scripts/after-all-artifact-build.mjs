// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { afterAllArtifactBuild as notarizeUniversalDMG } from './notarize-universal-dmg.mjs';

/** @import { BuildResult } from 'electron-builder' */

/**
 * @param {BuildResult} result
 * @returns {Promise<Array<string>>}
 */
export async function afterAllArtifactBuild(result) {
  await notarizeUniversalDMG(result);
  return [];
}
