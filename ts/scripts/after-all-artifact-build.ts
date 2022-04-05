// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BuildResult } from 'electron-builder';
import { afterAllArtifactBuild as stapleNotarization } from './staple-notarization';

export async function afterAllArtifactBuild(
  result: BuildResult
): Promise<Array<string>> {
  await stapleNotarization(result);
  return [];
}
