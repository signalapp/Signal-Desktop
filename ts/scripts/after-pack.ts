// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AfterPackContext } from 'electron-builder';
import { afterPack as fuseElectron } from './fuse-electron.js';
import { afterPack as copyPacks } from './copy-language-packs.js';
import { afterPack as pruneMacOSRelease } from './prune-macos-release.js';
import { afterPack as ensureLinuxFilePermissions } from './ensure-linux-file-permissions.js';

export async function afterPack(context: AfterPackContext): Promise<void> {
  await pruneMacOSRelease(context);
  await fuseElectron(context);
  await copyPacks(context);
  await ensureLinuxFilePermissions(context);
}
