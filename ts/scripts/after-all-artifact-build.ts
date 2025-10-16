// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BuildResult } from 'electron-builder';
import { afterAllArtifactBuild as notarizeUniversalDMG } from './notarize-universal-dmg.node.js';

export async function afterAllArtifactBuild(
  result: BuildResult
): Promise<Array<string>> {
  await notarizeUniversalDMG(result);
  return [];
}
