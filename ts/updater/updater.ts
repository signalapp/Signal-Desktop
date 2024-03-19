/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable no-console */
import * as path from 'path';
import { app, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import * as fs from 'fs-extra';
import { gt as isVersionGreaterThan, parse as parseVersion } from 'semver';

import { windowMarkShouldQuit } from '../node/window_state';

import { getLastestRelease } from '../node/latest_desktop_release';
import {
  getPrintableError,
  LoggerType,
  MessagesType,
  showCannotUpdateDialog,
  showDownloadUpdateDialog,
  showUpdateDialog,
} from './common';

let isUpdating = false;
let downloadIgnored = false;
let interval: NodeJS.Timeout | undefined;
let stopped = false;
// eslint:disable: no-console

export async function start(
  getMainWindow: () => BrowserWindow | null,
  messages: MessagesType,
  logger: LoggerType
) {
  if (interval) {
    logger.info('auto-update: Already running');

    return;
  }

  logger.info('auto-update: starting checks...');

  autoUpdater.logger = logger;
  autoUpdater.autoDownload = false;

  interval = global.setInterval(
    async () => {
      try {
        await checkForUpdates(getMainWindow, messages, logger);
      } catch (error) {
        logger.error('auto-update: error:', getPrintableError(error));
      }
    },
    1000 * 60 * 10
  ); // trigger and try to update every 10 minutes to let the file gets downloaded if we are updating
  stopped = false;

  global.setTimeout(
    async () => {
      try {
        await checkForUpdates(getMainWindow, messages, logger);
      } catch (error) {
        logger.error('auto-update: error:', getPrintableError(error));
      }
    },
    2 * 60 * 1000
  ); // we do checks from the fileserver every 1 minute.
}

export function stop() {
  if (interval) {
    clearInterval(interval);
    interval = undefined;
  }
  stopped = true;
}

async function checkForUpdates(
  getMainWindow: () => BrowserWindow | null,
  messages: MessagesType,
  logger: LoggerType
) {
  logger.info('[updater] checkForUpdates');
  if (stopped || isUpdating || downloadIgnored) {
    return;
  }

  const canUpdate = await canAutoUpdate();
  logger.info('[updater] canUpdate', canUpdate);
  if (!canUpdate) {
    logger.info('checkForUpdates canAutoUpdate false');
    return;
  }

  logger.info('[updater] checkForUpdates...');

  isUpdating = true;

  try {
    const latestVersionFromFsFromRenderer = getLastestRelease();

    logger.info('[updater] latestVersionFromFsFromRenderer', latestVersionFromFsFromRenderer);
    if (!latestVersionFromFsFromRenderer || !latestVersionFromFsFromRenderer?.length) {
      logger.info(
        '[updater] testVersionFromFsFromRenderer was not updated yet by renderer. Skipping update check'
      );
      return;
    }

    const currentVersion = autoUpdater.currentVersion.toString();
    const isMoreRecent = isVersionGreaterThan(latestVersionFromFsFromRenderer, currentVersion);
    logger.info('[updater] checkForUpdates isMoreRecent', isMoreRecent);
    if (!isMoreRecent) {
      logger.info(
        `Fileserver has no update so we are not looking for an update from github current:${currentVersion} fromFileServer:${latestVersionFromFsFromRenderer}`
      );
      return;
    }

    // Get the update using electron-updater, this fetches from github
    const result = await autoUpdater.checkForUpdates();

    logger.info('[updater] checkForUpdates got github response back ');

    if (!result?.updateInfo) {
      logger.info('[updater] no update info received');

      return;
    }

    try {
      const hasUpdate = isUpdateAvailable(result.updateInfo);
      logger.info('[updater] hasUpdate:', hasUpdate);

      if (!hasUpdate) {
        logger.info('[updater] no update available');

        return;
      }

      const mainWindow = getMainWindow();
      if (!mainWindow) {
        console.error('cannot showDownloadUpdateDialog, mainWindow is unset');
        return;
      }
      logger.info('[updater] showing download dialog...');
      const shouldDownload = await showDownloadUpdateDialog(mainWindow, messages);
      logger.info('[updater] shouldDownload:', shouldDownload);

      if (!shouldDownload) {
        downloadIgnored = true;

        return;
      }

      await autoUpdater.downloadUpdate();
    } catch (error) {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        console.error('cannot showDownloadUpdateDialog, mainWindow is unset');
        return;
      }
      await showCannotUpdateDialog(mainWindow, messages);
      throw error;
    }
    const window = getMainWindow();
    if (!window) {
      console.error('cannot showDownloadUpdateDialog, mainWindow is unset');
      return;
    }
    // Update downloaded successfully, we should ask the user to update
    logger.info('[updater] showing update dialog...');
    const shouldUpdate = await showUpdateDialog(window, messages);
    if (!shouldUpdate) {
      return;
    }

    logger.info('[updater] calling quitAndInstall...');
    windowMarkShouldQuit();
    autoUpdater.quitAndInstall();
  } finally {
    isUpdating = false;
  }
}

function isUpdateAvailable(updateInfo: UpdateInfo): boolean {
  const latestVersion = parseVersion(updateInfo.version);
  if (!latestVersion) {
    return false;
  }

  // We need to convert this to string because typescript won't let us use types across submodules ....
  const currentVersion = autoUpdater.currentVersion.toString();

  return isVersionGreaterThan(latestVersion, currentVersion);
}

/*
  Check if we have the required files to auto update.
  These files won't exist inside certain formats such as a linux deb file.
*/
async function canAutoUpdate(): Promise<boolean> {
  const isPackaged = app.isPackaged;

  // On a production app, we need to use resources path to check for the file
  if (isPackaged && !process.resourcesPath) {
    return false;
  }

  // Taken from: https://github.com/electron-userland/electron-builder/blob/d4feb6d3c8b008f8b455c761d654c8088f90d8fa/packages/electron-updater/src/ElectronAppAdapter.ts#L25
  const updateFile = isPackaged ? 'app-update.yml' : 'dev-app-update.yml';
  const basePath = isPackaged && process.resourcesPath ? process.resourcesPath : app.getAppPath();
  const appUpdateConfigPath = path.join(basePath, updateFile);

  return new Promise(resolve => {
    try {
      const exists = fs.existsSync(appUpdateConfigPath);
      resolve(exists);
    } catch (e) {
      resolve(false);
    }
  });
}
