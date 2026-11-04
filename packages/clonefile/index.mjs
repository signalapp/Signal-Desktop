// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { copyFile, constants } from 'node:fs/promises';
import bindings from 'bindings';

let addon;

function getAddon() {
  if (addon === undefined) {
    addon = bindings('clonefile');
  }

  return addon;
}

export async function clonefile(src, dst) {
  if (typeof src !== 'string' || typeof dst !== 'string') {
    throw new Error('Expected strings as src/dst arguments');
  }

  if (process.platform === 'darwin') {
    try {
      getAddon().clonefile(src, dst);
      return;
    } catch {
      // Fallback to copyFile if the file system doesn't support clonefile
    }
  }

  await copyFile(
    src,
    dst,
    constants.COPYFILE_FICLONE
  );
}
