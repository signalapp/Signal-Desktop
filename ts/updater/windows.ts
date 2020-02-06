import { dirname, join } from 'path';
import { spawn as spawnEmitter, SpawnOptions } from 'child_process';
import { readdir as readdirCallback, unlink as unlinkCallback } from 'fs';

import { app, BrowserWindow } from 'electron';
import { get as getFromConfig } from 'config';
import { gt } from 'semver';
import pify from 'pify';

import {
  checkForUpdates,
  deleteTempDir,
  downloadUpdate,
  getPrintableError,
  LoggerType,
  MessagesType,
  showCannotUpdateDialog,
  showUpdateDialog,
} from './common';
import { hexToBinary, verifySignature } from './signature';
import { markShouldQuit } from '../../app/window_state';

const readdir = pify(readdirCallback);
const unlink = pify(unlinkCallback);

let isChecking = false;
const SECOND = 1000;
const MINUTE = SECOND * 60;
const INTERVAL = MINUTE * 30;

export async function start(
  getMainWindow: () => BrowserWindow,
  messages: MessagesType,
  logger: LoggerType
) {
  logger.info('windows/start: starting checks...');

  loggerForQuitHandler = logger;
  app.once('quit', quitHandler);

  setInterval(async () => {
    try {
      await checkDownloadAndInstall(getMainWindow, messages, logger);
    } catch (error) {
      logger.error('windows/start: error:', getPrintableError(error));
    }
  }, INTERVAL);

  await deletePreviousInstallers(logger);
  await checkDownloadAndInstall(getMainWindow, messages, logger);
}

let fileName: string;
let version: string;
let updateFilePath: string;
let installing: boolean;
let loggerForQuitHandler: LoggerType;

async function checkDownloadAndInstall(
  getMainWindow: () => BrowserWindow,
  messages: MessagesType,
  logger: LoggerType
) {
  if (isChecking) {
    return;
  }

  try {
    isChecking = true;

    logger.info('checkDownloadAndInstall: checking for update...');
    const result = await checkForUpdates(logger);
    if (!result) {
      return;
    }

    const { fileName: newFileName, version: newVersion } = result;
    if (fileName !== newFileName || !version || gt(newVersion, version)) {
      deleteCache(updateFilePath, logger);
      fileName = newFileName;
      version = newVersion;
      updateFilePath = await downloadUpdate(fileName, logger);
    }

    const publicKey = hexToBinary(getFromConfig('updatesPublicKey'));
    const verified = verifySignature(updateFilePath, version, publicKey);
    if (!verified) {
      // Note: We don't delete the cache here, because we don't want to continually
      //   re-download the broken release. We will download it only once per launch.
      throw new Error(
        `Downloaded update did not pass signature verification (version: '${version}'; fileName: '${fileName}')`
      );
    }

    logger.info('checkDownloadAndInstall: showing dialog...');
    const shouldUpdate = await showUpdateDialog(getMainWindow(), messages);
    if (!shouldUpdate) {
      return;
    }

    try {
      await verifyAndInstall(updateFilePath, version, logger);
      installing = true;
    } catch (error) {
      logger.info(
        'checkDownloadAndInstall: showing general update failure dialog...'
      );
      await showCannotUpdateDialog(getMainWindow(), messages);

      throw error;
    }

    markShouldQuit();
    app.quit();
  } catch (error) {
    logger.error('checkDownloadAndInstall: error', getPrintableError(error));
  } finally {
    isChecking = false;
  }
}

function quitHandler() {
  if (updateFilePath && !installing) {
    verifyAndInstall(updateFilePath, version, loggerForQuitHandler).catch(
      error => {
        loggerForQuitHandler.error(
          'quitHandler: error installing:',
          getPrintableError(error)
        );
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
  const publicKey = hexToBinary(getFromConfig('updatesPublicKey'));
  const verified = verifySignature(updateFilePath, newVersion, publicKey);
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
    stdio: 'ignore' as 'ignore', // TypeScript considers this a plain string without help
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
      logger.error(
        'deleteCache: error deleting temporary directory',
        getPrintableError(error)
      );
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

    // tslint:disable-next-line no-string-based-set-timeout
    setTimeout(resolve, 200);
  });
}
