// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AfterPackContext } from 'electron-builder';
import { afterPack as fuseElectron } from './fuse-electron';
import { afterPack as mergeASARs } from './merge-macos-asars';

export async function afterPack(context: AfterPackContext): Promise<void> {
  await mergeASARs(context);
  await fuseElectron(context);
}
