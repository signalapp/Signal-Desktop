import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { markShouldQuit } from '../../app/window_state';
import {
  getPrintableError,
  LoggerType,
  MessagesType,
  showCannotUpdateDialog,
  showUpdateDialog,
} from './common';

let isUpdating = false;

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
  if (isUpdating) {
    return;
  }

  logger.info('auto-update: checking for update...');

  try {
    // Get the update using electron-updater
    try {
      const info = await autoUpdater.checkForUpdates();
      if (!info.downloadPromise) {
        logger.info('auto-update: no update to download');

        return;
      }
      await info.downloadPromise;
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
