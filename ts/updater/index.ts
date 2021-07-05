// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { get as getFromConfig } from 'config';
import { BrowserWindow } from 'electron';

import { UpdaterInterface } from './common';
import { start as startMacOS } from './macos';
import { start as startWindows } from './windows';
import { LocaleType } from '../types/I18N';
import { LoggerType } from '../types/Logging';

let initialized = false;

let updater: UpdaterInterface | undefined;

export async function start(
  getMainWindow: () => BrowserWindow,
  locale?: LocaleType,
  logger?: LoggerType
): Promise<void> {
  const { platform } = process;

  if (initialized) {
    throw new Error('updater/start: Updates have already been initialized!');
  }
  initialized = true;

  if (!locale) {
    throw new Error('updater/start: Must provide locale!');
  }
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
    updater = await startWindows(getMainWindow, locale, logger);
  } else if (platform === 'darwin') {
    updater = await startMacOS(getMainWindow, locale, logger);
  } else {
    throw new Error('updater/start: Unsupported platform');
  }
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
    process.platform === 'linux' ||
    process.mas ||
    !getFromConfig('updatesEnabled')
  );
}
