// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { app } from 'electron';
import { join } from 'node:path';

export function getAppRootDir(): string {
  // We have this logic because test-node runs under `electron-mocha` that has
  // `app.getAppPath()` pointing within `electron-mocha`'s folder.
  if (app.isPackaged || process.env.IS_BUNDLED) {
    return app.getAppPath();
  }
  // oxlint-disable-next-line no-restricted-globals
  return join(__dirname, '..', '..');
}
