// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { afterPack as fuseElectron } from './fuse-electron.mjs';
import { afterPack as copyPacks } from './copy-language-packs.mjs';
import { afterPack as pruneMacOSRelease } from './prune-macos-release.mjs';
import { afterPack as ensureLinuxFilePermissions } from './ensure-linux-file-permissions.mjs';

/** @import { AfterPackContext } from 'electron-builder' */

/**
 * @param {AfterPackContext} context
 * @returns {Promise<void>}
 */
export async function afterPack(context) {
  await pruneMacOSRelease(context);
  await fuseElectron(context);
  await copyPacks(context);
  await ensureLinuxFilePermissions(context);
}
