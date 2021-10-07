// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { dirname, join } from 'path';
import { spawn as spawnEmitter, SpawnOptions } from 'child_process';
import { readdir as readdirCallback, unlink as unlinkCallback } from 'fs';

import { app, BrowserWindow } from 'electron';
import config from 'config';
import { gt } from 'semver';
import pify from 'pify';

import {
  checkForUpdates,
  deleteTempDir,
  downloadUpdate,
  getAutoDownloadUpdateSetting,
  getPrintableError,
  setUpdateListener,
  UpdaterInterface,
} from './common';
import * as durations from '../util/durations';
import { LoggerType } from '../types/Logging';
import { hexToBinary, verifySignature } from './signature';
import { markShouldQuit } from '../../app/window_state';
import { DialogType } from '../types/Dialogs';

const readdir = pify(readdirCallback);
const unlink = pify(unlinkCallback);

const INTERVAL = 30 * durations.MINUTE;

let fileName: string;
let version: string;
let updateFilePath: string;
let installing: boolean;
let loggerForQuitHandler: LoggerType;

export async function start(
  getMainWindow: () => BrowserWindow | undefined,
  logger: LoggerType
): Promise<UpdaterInterface> {
  logger.info('windows/start: starting checks...');

  loggerForQuitHandler = logger;
  app.once('quit', quitHandler);

  setInterval(async () => {
    try {
      await checkForUpdatesMaybeInstall(getMainWindow, logger);
    } catch (error) {
      logger.error(`windows/start: ${getPrintableError(error)}`);
    }
  }, INTERVAL);

  await deletePreviousInstallers(logger);
  await checkForUpdatesMaybeInstall(getMainWindow, logger);

  return {
    async force(): Promise<void> {
      return checkForUpdatesMaybeInstall(getMainWindow, logger, true);
    },
  };
}

async function checkForUpdatesMaybeInstall(
  getMainWindow: () => BrowserWindow | undefined,
  logger: LoggerType,
  force = false
) {
  logger.info('checkForUpdatesMaybeInstall: checking for update...');
  const result = await checkForUpdates(logger, force);
  if (!result) {
    return;
  }

  const { fileName: newFileName, version: newVersion } = result;

  if (
    force ||
    fileName !== newFileName ||
    !version ||
    gt(newVersion, version)
  ) {
    const autoDownloadUpdates = await getAutoDownloadUpdateSetting(
      getMainWindow(),
      logger
    );
    if (!autoDownloadUpdates) {
      setUpdateListener(async () => {
        logger.info(
          'checkForUpdatesMaybeInstall: have not downloaded update, going to download'
        );
        await downloadAndInstall(
          newFileName,
          newVersion,
          getMainWindow,
          logger,
          true
        );
      });
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(
          'show-update-dialog',
          DialogType.DownloadReady,
          {
            downloadSize: result.size,
            version: result.version,
          }
        );
      } else {
        logger.warn(
          'checkForUpdatesMaybeInstall: No mainWindow, not showing update dialog'
        );
      }
      return;
    }
    await downloadAndInstall(newFileName, newVersion, getMainWindow, logger);
  }
}

async function downloadAndInstall(
  newFileName: string,
  newVersion: string,
  getMainWindow: () => BrowserWindow | undefined,
  logger: LoggerType,
  updateOnProgress?: boolean
) {
  try {
    const oldFileName = fileName;
    const oldVersion = version;

    deleteCache(updateFilePath, logger);
    fileName = newFileName;
    version = newVersion;

    try {
      updateFilePath = await downloadUpdate(
        fileName,
        logger,
        updateOnProgress ? getMainWindow() : undefined
      );
    } catch (error) {
      // Restore state in case of download error
      fileName = oldFileName;
      version = oldVersion;
      throw error;
    }

    const publicKey = hexToBinary(config.get('updatesPublicKey'));
    const verified = await verifySignature(updateFilePath, version, publicKey);
    if (!verified) {
      // Note: We don't delete the cache here, because we don't want to continually
      //   re-download the broken release. We will download it only once per launch.
      throw new Error(
        `Downloaded update did not pass signature verification (version: '${version}'; fileName: '${fileName}')`
      );
    }

    logger.info('downloadAndInstall: showing dialog...');
    setUpdateListener(async () => {
      try {
        await verifyAndInstall(updateFilePath, newVersion, logger);
        installing = true;
      } catch (error) {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          logger.info(
            'createUpdater: showing general update failure dialog...'
          );
          mainWindow.webContents.send(
            'show-update-dialog',
            DialogType.Cannot_Update
          );
        } else {
          logger.warn('createUpdater: no mainWindow, just failing over...');
        }

        throw error;
      }

      markShouldQuit();
      app.quit();
    });

    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('show-update-dialog', DialogType.Update, {
        version,
      });
    } else {
      logger.warn(
        'downloadAndInstall: no mainWindow, cannot show update dialog'
      );
    }
  } catch (error) {
    logger.error(`downloadAndInstall: ${getPrintableError(error)}`);
  }
}

function quitHandler() {
  if (updateFilePath && !installing) {
    verifyAndInstall(updateFilePath, version, loggerForQuitHandler).catch(
      error => {
        loggerForQuitHandler.error(`quitHandler: ${getPrintableError(error)}`);
      }
    );
  }
}

// Helpers

// This is fixed by out new install mechanisms...
//   https://github.com/signalapp/Signal-Desktop/issues/2369
// ...but we should also clean up those old installers.
const IS_EXE = /\.exe$/i;
async function deletePreviousInstallers(logger: LoggerType) {
  const userDataPath = app.getPath('userData');
  const files: Array<string> = await readdir(userDataPath);
  await Promise.all(
    files.map(async file => {
      const isExe = IS_EXE.test(file);
      if (!isExe) {
        return;
      }

      const fullPath = join(userDataPath, file);
      try {
        await unlink(fullPath);
      } catch (error) {
        logger.error(`deletePreviousInstallers: couldn't delete file ${file}`);
      }
    })
  );
}

async function verifyAndInstall(
  filePath: string,
  newVersion: string,
  logger: LoggerType
) {
  if (installing) {
    return;
  }

  const publicKey = hexToBinary(config.get('updatesPublicKey'));
  const verified = await verifySignature(updateFilePath, newVersion, publicKey);
  if (!verified) {
    throw new Error(
      `Downloaded update did not pass signature verification (version: '${newVersion}'; fileName: '${fileName}')`
    );
  }

  await install(filePath, logger);
}

async function install(filePath: string, logger: LoggerType): Promise<void> {
  logger.info('windows/install: installing package...');
  const args = ['--updated'];
  const options = {
    detached: true,
    stdio: 'ignore' as const, // TypeScript considers this a plain string without help
  };

  try {
    await spawn(filePath, args, options);
  } catch (error) {
    if (error.code === 'UNKNOWN' || error.code === 'EACCES') {
      logger.warn(
        'windows/install: Error running installer; Trying again with elevate.exe'
      );
      await spawn(getElevatePath(), [filePath, ...args], options);

      return;
    }

    throw error;
  }
}

function deleteCache(filePath: string | null, logger: LoggerType) {
  if (filePath) {
    const tempDir = dirname(filePath);
    deleteTempDir(tempDir).catch(error => {
      logger.error(`deleteCache: ${getPrintableError(error)}`);
    });
  }
}
function getElevatePath() {
  const installPath = app.getAppPath();

  return join(installPath, 'resources', 'elevate.exe');
}

async function spawn(
  exe: string,
  args: Array<string>,
  options: SpawnOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const emitter = spawnEmitter(exe, args, options);
    emitter.on('error', reject);
    emitter.unref();

    setTimeout(resolve, 200);
  });
}
