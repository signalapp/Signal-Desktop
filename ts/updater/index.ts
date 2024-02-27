// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import config from 'config';

import type { Updater, UpdaterOptionsType } from './common';
import { MacOSUpdater } from './macos';
import { WindowsUpdater } from './windows';
import { isLinuxVersionSupported } from './linux';
import { DialogType } from '../types/Dialogs';

let initialized = false;

let updater: Updater | undefined;

export async function start(options: UpdaterOptionsType): Promise<void> {
  const { platform } = process;
  const { logger, getMainWindow } = options;

  if (initialized) {
    throw new Error('updater/start: Updates have already been initialized!');
  }
  initialized = true;

  if (!logger) {
    throw new Error('updater/start: Must provide logger!');
  }

  if (platform === 'linux') {
    if (!isLinuxVersionSupported(logger)) {
      getMainWindow()?.webContents.send(
        'show-update-dialog',
        DialogType.UnsupportedOS
      );
    }
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
  } else {
    throw new Error('updater/start: Unsupported platform');
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

export function onRestartCancelled(): void {
  if (updater) {
    updater.onRestartCancelled();
  }
}

function autoUpdateDisabled() {
  return (
    process.platform === 'linux' || process.mas || !config.get('updatesEnabled')
  );
}
