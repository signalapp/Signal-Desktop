// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AfterPackContext } from 'electron-builder';
import { afterPack as fuseElectron } from './fuse-electron';
import { afterPack as mergeASARs } from './merge-macos-asars';
import { afterPack as copyPacks } from './copy-language-packs';
import { afterPack as pruneMacOSRelease } from './prune-macos-release';
import { afterPack as notarize } from './notarize';

export async function afterPack(context: AfterPackContext): Promise<void> {
  await pruneMacOSRelease(context);
  await mergeASARs(context);
  await fuseElectron(context);
  await copyPacks(context);

  // This must be the last step
  await notarize(context);
}
