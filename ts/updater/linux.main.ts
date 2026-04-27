// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { version as osVersion } from 'node:os';
import { watch } from 'node:fs';
import { join } from 'node:path';
import { app, ipcMain } from 'electron';
import { extractFile } from '@electron/asar';
import z from 'zod';

import { markShouldQuit } from '../../app/window_state.std.ts';
import type { LoggerType } from '../types/Logging.std.ts';
import { DialogType } from '../types/Dialogs.std.ts';
import * as Errors from '../types/errors.std.ts';
import type { UpdaterOptionsType } from './common.main.ts';
import { appRelaunch } from '../util/relaunch.main.ts';
import { getAppRootDir } from '../util/appRootDir.main.ts';

const MIN_UBUNTU_VERSION = '22.04';

const PackageSchema = z.object({
  version: z.string(),
});

function getUbuntuVersion(): string | undefined {
  if (process.platform !== 'linux') {
    return undefined;
  }

  const match = osVersion().match(/^#\d+~([\d.]+)-Ubuntu\s/);
  if (!match) {
    return undefined;
  }

  return match[1];
}

function isLinuxVersionSupported(logger?: LoggerType): boolean {
  const ubuntu = getUbuntuVersion();
  if (ubuntu !== undefined && ubuntu < MIN_UBUNTU_VERSION) {
    logger?.warn(
      `updater/isLinuxVersionSupported: unsupported Ubuntu version ${ubuntu}`
    );
    return false;
  }

  return true;
}

export function initLinux({ logger, getMainWindow }: UpdaterOptionsType): void {
  if (!app.isPackaged) {
    throw new Error('Linux updates are not supported in development');
  }

  if (!isLinuxVersionSupported(logger)) {
    getMainWindow()?.webContents.send(
      'show-update-dialog',
      DialogType.UnsupportedOS
    );
  }

  ipcMain.handle('start-update', () => {
    logger?.info('updater/linux: restarting');
    markShouldQuit();
    appRelaunch();
    app.quit();
  });

  // In `postinst` script we run `touch .signal-postinst`.
  // See our patch for app-builder-lib.
  //
  // /opt/Signal/resources/app.asar
  const asarPath = getAppRootDir();
  if (!asarPath.endsWith('.asar')) {
    throw new Error('updater/linux: not running from ASAR');
  }

  // /opt/Signal/.signal-postinst
  const postinstFile = join(asarPath, '..', '..', '.signal-postinst');

  watch(postinstFile, event => {
    if (event !== 'change') {
      return;
    }

    let version: string;
    try {
      const file = extractFile(asarPath, 'package.json').toString();
      ({ version } = PackageSchema.parse(JSON.parse(file)));
    } catch (error) {
      logger?.error(
        'updater/linux: failed to parse updated asar',
        Errors.toLogFormat(error)
      );
      return;
    }

    if (version === app.getVersion()) {
      logger?.info('updater/linux: ignoring asar update, no version change');
      return;
    }

    logger?.info(`updater/linux: asar updated to version=${version}`);
    getMainWindow()?.webContents.send(
      'show-update-dialog',
      DialogType.AutoUpdate,
      {
        version,
      }
    );
  }).unref();
}
