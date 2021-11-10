// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import config from 'config';
import type { BrowserWindow } from 'electron';

import type { Updater } from './common';
import { MacOSUpdater } from './macos';
import { WindowsUpdater } from './windows';
import type { LoggerType } from '../types/Logging';
import type { SettingsChannel } from '../main/settingsChannel';

let initialized = false;

let updater: Updater | undefined;

export async function start(
  settingsChannel: SettingsChannel,
  logger: LoggerType,
  getMainWindow: () => BrowserWindow | undefined
): Promise<void> {
  const { platform } = process;

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
    updater = new WindowsUpdater(logger, settingsChannel, getMainWindow);
  } else if (platform === 'darwin') {
    updater = new MacOSUpdater(logger, settingsChannel, getMainWindow);
  } else {
    throw new Error('updater/start: Unsupported platform');
  }

  await updater.start();
}

export async function force(): Promise<void> {
  if (!initialized) {
    throw new Error("updater/force: Updates haven't been initialized!");
  }

  if (updater) {
    await updater.force();
  }
}

function autoUpdateDisabled() {
  return (
    process.platform === 'linux' || process.mas || !config.get('updatesEnabled')
  );
}
