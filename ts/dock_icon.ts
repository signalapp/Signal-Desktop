// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { app } from 'electron';

export function show(): void {
  if (process.platform === 'darwin') {
    app.dock.show();
  }
}

export function hide(): void {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
}
