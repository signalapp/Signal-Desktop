// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AfterPackContext } from 'electron-builder';
import { afterPack as fuseElectron } from './fuse-electron.node.ts';
import { afterPack as copyPacks } from './copy-language-packs.node.ts';
import { afterPack as pruneMacOSRelease } from './prune-macos-release.node.ts';
import { afterPack as ensureLinuxFilePermissions } from './ensure-linux-file-permissions.node.ts';

export async function afterPack(context: AfterPackContext): Promise<void> {
  await pruneMacOSRelease(context);
  await fuseElectron(context);
  await copyPacks(context);
  await ensureLinuxFilePermissions(context);
}
