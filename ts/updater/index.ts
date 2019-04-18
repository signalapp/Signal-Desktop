import { get as getFromConfig } from 'config';
import { BrowserWindow } from 'electron';

import { start as startMacOS } from './macos';
import { start as startWindows } from './windows';
import {
  deleteBaseTempDir,
  getPrintableError,
  LoggerType,
  MessagesType,
} from './common';

let initialized = false;

export async function start(
  getMainWindow: () => BrowserWindow,
  messages?: MessagesType,
  logger?: LoggerType
) {
  const { platform } = process;

  if (initialized) {
    throw new Error('updater/start: Updates have already been initialized!');
  }
  initialized = true;

  if (!messages) {
    throw new Error('updater/start: Must provide messages!');
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

  try {
    await deleteBaseTempDir();
  } catch (error) {
    logger.error(
      'updater/start: Error deleting temp dir:',
      getPrintableError(error)
    );
  }

  if (platform === 'win32') {
    await startWindows(getMainWindow, messages, logger);
  } else if (platform === 'darwin') {
    await startMacOS(getMainWindow, messages, logger);
  } else {
    throw new Error('updater/start: Unsupported platform');
  }
}

function autoUpdateDisabled() {
  return (
    process.platform === 'linux' ||
    process.mas ||
    !getFromConfig('updatesEnabled')
  );
}
