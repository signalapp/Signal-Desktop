// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AfterPackContext } from 'electron-builder';
import { afterPack as fuseElectron } from './fuse-electron';
import { afterPack as mergeASARs } from './merge-macos-asars';
import { afterPack as copyPacks } from './copy-language-packs';

export async function afterPack(context: AfterPackContext): Promise<void> {
  await mergeASARs(context);
  await fuseElectron(context);
  await copyPacks(context);
}
