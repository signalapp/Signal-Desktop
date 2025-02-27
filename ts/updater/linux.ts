// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { version as osVersion } from 'node:os';
import { watch } from 'node:fs';
import { join } from 'node:path';
import { app, ipcMain } from 'electron';
import { extractFile } from '@electron/asar';
import z from 'zod';

import { markShouldQuit } from '../../app/window_state';
import type { LoggerType } from '../types/Logging';
import { DialogType } from '../types/Dialogs';
import * as Errors from '../types/errors';
import type { UpdaterOptionsType } from './common';

const MIN_UBUNTU_VERSION = '20.04';

const PackageSchema = z.object({
  version: z.string(),
});

export function getUbuntuVersion(): string | undefined {
  if (process.platform !== 'linux') {
    return undefined;
  }

  const match = osVersion().match(/^#\d+~([\d.]+)-Ubuntu\s/);
  if (!match) {
    return undefined;
  }

  return match[1];
}

export function isLinuxVersionSupported(logger?: LoggerType): boolean {
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
    app.relaunch();
    app.quit();
  });

  const asarPath = join(__dirname, '..', '..');
  if (!asarPath.endsWith('.asar')) {
    throw new Error('updater/linux: not running from ASAR');
  }

  watch(asarPath, event => {
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
