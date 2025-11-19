// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { app } from 'electron';
import type { RelaunchOptions } from 'electron';

import OS from './os/osMain.node.js';

// app.relaunch() doesn't work in AppImage, so this is a workaround
export function appRelaunch(): void {
  if (!OS.isAppImage()) {
    app.relaunch();
    return;
  }

  const options: RelaunchOptions = {
    args: ['--appimage-extract-and-run', ...process.argv],
    execPath: process.env.APPIMAGE,
  };
  app.relaunch(options);
}
