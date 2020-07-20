import { createReadStream, statSync } from 'fs';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { dirname } from 'path';

import { v4 as getGuid } from 'uuid';
import { app, autoUpdater, BrowserWindow, dialog, ipcMain } from 'electron';
import { get as getFromConfig } from 'config';
import { gt } from 'semver';
import got from 'got';

import {
  ACK_RENDER_TIMEOUT,
  checkForUpdates,
  deleteTempDir,
  downloadUpdate,
  getPrintableError,
  setUpdateListener,
  showCannotUpdateDialog,
  showUpdateDialog,
} from './common';
import { LocaleType } from '../types/I18N';
import { LoggerType } from '../types/Logging';
import { hexToBinary, verifySignature } from './signature';
import { markShouldQuit } from '../../app/window_state';
import { Dialogs } from '../types/Dialogs';

const SECOND = 1000;
const MINUTE = SECOND * 60;
const INTERVAL = MINUTE * 30;

export async function start(
  getMainWindow: () => BrowserWindow,
  locale: LocaleType,
  logger: LoggerType
) {
  logger.info('macos/start: starting checks...');

  loggerForQuitHandler = logger;
  app.once('quit', quitHandler);

  setInterval(async () => {
    try {
      await checkDownloadAndInstall(getMainWindow, locale, logger);
    } catch (error) {
      logger.error('macos/start: error:', getPrintableError(error));
    }
  }, INTERVAL);

  setUpdateListener(createUpdater(logger));

  await checkDownloadAndInstall(getMainWindow, locale, logger);
}

let fileName: string;
let version: string;
let updateFilePath: string;
let loggerForQuitHandler: LoggerType;

async function checkDownloadAndInstall(
  getMainWindow: () => BrowserWindow,
  locale: LocaleType,
  logger: LoggerType
) {
  logger.info('checkDownloadAndInstall: checking for update...');
  try {
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

    if (!updateFilePath) {
      logger.info('checkDownloadAndInstall: no update file path. Skipping!');
      return;
    }

    const publicKey = hexToBinary(getFromConfig('updatesPublicKey'));
    const verified = await verifySignature(updateFilePath, version, publicKey);
    if (!verified) {
      // Note: We don't delete the cache here, because we don't want to continually
      //   re-download the broken release. We will download it only once per launch.
      throw new Error(
        `checkDownloadAndInstall: Downloaded update did not pass signature verification (version: '${version}'; fileName: '${fileName}')`
      );
    }

    try {
      await handToAutoUpdate(updateFilePath, logger);
    } catch (error) {
      const readOnly = 'Cannot update while running on a read-only volume';
      const message: string = error.message || '';
      if (message.includes(readOnly)) {
        logger.info('checkDownloadAndInstall: showing read-only dialog...');
        showReadOnlyDialog(getMainWindow(), locale);
      } else {
        logger.info(
          'checkDownloadAndInstall: showing general update failure dialog...'
        );
        showCannotUpdateDialog(getMainWindow(), locale);
      }

      throw error;
    }

    // At this point, closing the app will cause the update to be installed automatically
    //   because Squirrel has cached the update file and will do the right thing.

    logger.info('checkDownloadAndInstall: showing update dialog...');

    showUpdateDialog(getMainWindow(), locale, createUpdater(logger));
  } catch (error) {
    logger.error('checkDownloadAndInstall: error', getPrintableError(error));
  }
}

function quitHandler() {
  deleteCache(updateFilePath, loggerForQuitHandler);
}

// Helpers

function deleteCache(filePath: string | null, logger: LoggerType) {
  if (filePath) {
    const tempDir = dirname(filePath);
    deleteTempDir(tempDir).catch(error => {
      logger.error(
        'quitHandler: error deleting temporary directory:',
        getPrintableError(error)
      );
    });
  }
}

async function handToAutoUpdate(
  filePath: string,
  logger: LoggerType
): Promise<void> {
  return new Promise((resolve, reject) => {
    const token = getGuid();
    const updateFileUrl = generateFileUrl();
    const server = createServer();
    let serverUrl: string;

    server.on('error', (error: Error) => {
      logger.error(
        'handToAutoUpdate: server had error',
        getPrintableError(error)
      );
      shutdown(server, logger);
      reject(error);
    });

    server.on(
      'request',
      (request: IncomingMessage, response: ServerResponse) => {
        const { url } = request;

        if (url === '/') {
          const absoluteUrl = `${serverUrl}${updateFileUrl}`;
          writeJSONResponse(absoluteUrl, response);

          return;
        }

        if (url === '/token') {
          writeTokenResponse(token, response);

          return;
        }

        if (!url || !url.startsWith(updateFileUrl)) {
          write404(url, response, logger);

          return;
        }

        pipeUpdateToSquirrel(filePath, server, response, logger, reject);
      }
    );

    server.listen(0, '127.0.0.1', async () => {
      try {
        serverUrl = getServerUrl(server);

        autoUpdater.on('error', (error: Error) => {
          logger.error('autoUpdater: error', getPrintableError(error));
          reject(error);
        });
        autoUpdater.on('update-downloaded', () => {
          logger.info('autoUpdater: update-downloaded event fired');
          shutdown(server, logger);
          resolve();
        });

        const response = await got.get(`${serverUrl}/token`);
        if (JSON.parse(response.body).token !== token) {
          throw new Error(
            'autoUpdater: did not receive token back from updates server'
          );
        }

        autoUpdater.setFeedURL({
          url: serverUrl,
          headers: { 'Cache-Control': 'no-cache' },
        });
        autoUpdater.checkForUpdates();
      } catch (error) {
        reject(error);

        return;
      }
    });
  });
}

function pipeUpdateToSquirrel(
  filePath: string,
  server: Server,
  response: ServerResponse,
  logger: LoggerType,
  reject: (error: Error) => void
) {
  const updateFileSize = getFileSize(filePath);
  const readStream = createReadStream(filePath);

  response.on('error', (error: Error) => {
    logger.error(
      'pipeUpdateToSquirrel: update file download request had an error',
      getPrintableError(error)
    );
    shutdown(server, logger);
    reject(error);
  });

  readStream.on('error', (error: Error) => {
    logger.error(
      'pipeUpdateToSquirrel: read stream error response:',
      getPrintableError(error)
    );
    shutdown(server, logger, response);
    reject(error);
  });

  response.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Length': updateFileSize,
  });

  readStream.pipe(response);
}

function writeJSONResponse(url: string, response: ServerResponse) {
  const data = Buffer.from(
    JSON.stringify({
      url,
    })
  );
  response.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': data.byteLength,
  });
  response.end(data);
}

function writeTokenResponse(token: string, response: ServerResponse) {
  const data = Buffer.from(
    JSON.stringify({
      token,
    })
  );
  response.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': data.byteLength,
  });
  response.end(data);
}

function write404(
  url: string | undefined,
  response: ServerResponse,
  logger: LoggerType
) {
  logger.error(`write404: Squirrel requested unexpected url '${url}'`);
  response.writeHead(404);
  response.end();
}

function getServerUrl(server: Server) {
  const address = server.address() as AddressInfo;

  // tslint:disable-next-line:no-http-string
  return `http://127.0.0.1:${address.port}`;
}
function generateFileUrl(): string {
  return `/${getGuid()}.zip`;
}

function getFileSize(targetPath: string): number {
  const { size } = statSync(targetPath);

  return size;
}

function shutdown(
  server: Server,
  logger: LoggerType,
  response?: ServerResponse
) {
  try {
    if (server) {
      server.close();
    }
  } catch (error) {
    logger.error('shutdown: Error closing server', getPrintableError(error));
  }

  try {
    if (response) {
      response.end();
    }
  } catch (endError) {
    logger.error(
      "shutdown: couldn't end response",
      getPrintableError(endError)
    );
  }
}

export function showReadOnlyDialog(
  mainWindow: BrowserWindow,
  locale: LocaleType
): void {
  let ack = false;

  ipcMain.once('show-update-dialog-ack', () => {
    ack = true;
  });

  mainWindow.webContents.send('show-update-dialog', Dialogs.MacOS_Read_Only);

  setTimeout(async () => {
    if (!ack) {
      await showFallbackReadOnlyDialog(mainWindow, locale);
    }
  }, ACK_RENDER_TIMEOUT);
}

let showingReadOnlyDialog = false;

async function showFallbackReadOnlyDialog(
  mainWindow: BrowserWindow,
  locale: LocaleType
) {
  if (showingReadOnlyDialog) {
    return;
  }

  const options = {
    type: 'warning',
    buttons: [locale.messages.ok.message],
    title: locale.messages.cannotUpdate.message,
    message: locale.i18n('readOnlyVolume', ['Signal.app', '/Applications']),
  };

  showingReadOnlyDialog = true;

  await dialog.showMessageBox(mainWindow, options);

  showingReadOnlyDialog = false;
}

function createUpdater(logger: LoggerType) {
  return () => {
    logger.info('performUpdate: calling quitAndInstall...');
    markShouldQuit();
    autoUpdater.quitAndInstall();
  };
}
