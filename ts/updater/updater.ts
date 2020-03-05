import * as path from 'path';
import * as fs from 'fs-extra';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app, BrowserWindow } from 'electron';
import { markShouldQuit } from '../../app/window_state';
import {
  getPrintableError,
  LoggerType,
  MessagesType,
  showCannotUpdateDialog,
  showDownloadUpdateDialog,
  showUpdateDialog,
} from './common';
import { gt as isVersionGreaterThan, parse as parseVersion } from 'semver';

let isUpdating = false;
let downloadIgnored = false;

const SECOND = 1000;
const MINUTE = SECOND * 60;
const INTERVAL = MINUTE * 30;

export async function start(
  getMainWindow: () => BrowserWindow,
  messages: MessagesType,
  logger: LoggerType
) {
  logger.info('auto-update: starting checks...');

  autoUpdater.logger = logger;
  autoUpdater.autoDownload = false;

  setInterval(async () => {
    try {
      await checkForUpdates(getMainWindow, messages, logger);
    } catch (error) {
      logger.error('auto-update: error:', getPrintableError(error));
    }
  }, INTERVAL);

  await checkForUpdates(getMainWindow, messages, logger);
}

async function checkForUpdates(
  getMainWindow: () => BrowserWindow,
  messages: MessagesType,
  logger: LoggerType
) {
  if (isUpdating || downloadIgnored) {
    return;
  }

  const canUpdate = await canAutoUpdate();
  if (!canUpdate) {
    return;
  }

  logger.info('auto-update: checking for update...');

  isUpdating = true;

  try {
    // Get the update using electron-updater
    const result = await autoUpdater.checkForUpdates();
    if (!result.updateInfo) {
      logger.info('auto-update: no update info received');

      return;
    }

    try {
      const hasUpdate = isUpdateAvailable(result.updateInfo);
      if (!hasUpdate) {
        logger.info('auto-update: no update available');

        return;
      }

      logger.info('auto-update: showing download dialog...');
      const shouldDownload = await showDownloadUpdateDialog(
        getMainWindow(),
        messages
      );
      if (!shouldDownload) {
        downloadIgnored = true;

        return;
      }

      await autoUpdater.downloadUpdate();
    } catch (error) {
      await showCannotUpdateDialog(getMainWindow(), messages);
      throw error;
    }

    // Update downloaded successfully, we should ask the user to update
    logger.info('auto-update: showing update dialog...');
    const shouldUpdate = await showUpdateDialog(getMainWindow(), messages);
    if (!shouldUpdate) {
      return;
    }

    logger.info('auto-update: calling quitAndInstall...');
    markShouldQuit();
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
  const basePath =
    isPackaged && process.resourcesPath
      ? process.resourcesPath
      : app.getAppPath();
  const appUpdateConfigPath = path.join(basePath, updateFile);

  return new Promise(resolve => {
    try {
      // tslint:disable-next-line: non-literal-fs-path
      const exists = fs.existsSync(appUpdateConfigPath);
      resolve(exists);
    } catch (e) {
      resolve(false);
    }
  });
}
