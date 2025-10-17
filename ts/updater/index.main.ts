// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import config from 'config';
import { app } from 'electron';
import type { Updater, UpdaterOptionsType } from './common.main.js';
import { MacOSUpdater } from './macos.main.js';
import { WindowsUpdater } from './windows.main.js';
import { initLinux } from './linux.main.js';

let initialized = false;

let updater: Updater | undefined;

export async function start(options: UpdaterOptionsType): Promise<void> {
  const { platform } = process;
  const { logger } = options;

  if (initialized) {
    throw new Error('updater/start: Updates have already been initialized!');
  }
  initialized = true;

  if (!logger) {
    throw new Error('updater/start: Must provide logger!');
  }

  if (autoUpdateDisabled()) {
    logger.info(
      'updater/start: Updates disabled - not starting new version checks'
    );

    return;
  }

  if (platform === 'win32') {
    updater = new WindowsUpdater(options);
  } else if (platform === 'darwin') {
    updater = new MacOSUpdater(options);
  } else if (platform === 'linux') {
    initLinux(options);
  } else {
    throw new Error(`updater/start: Unsupported platform ${platform}`);
  }

  await updater?.start();
}

export async function force(): Promise<void> {
  if (!initialized) {
    throw new Error("updater/force: Updates haven't been initialized!");
  }

  if (updater) {
    await updater.force();
  }
}

export function onRestartCanceled(): void {
  if (updater) {
    updater.onRestartCanceled();
  }
}

function autoUpdateDisabled() {
  return !app.isPackaged || process.mas || !config.get('updatesEnabled');
}
