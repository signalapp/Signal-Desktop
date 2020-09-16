import { get as getFromConfig } from 'config';
import { BrowserWindow } from 'electron';

import { start as startMacOS } from './macos';
import { start as startWindows } from './windows';
import { LocaleType } from '../types/I18N';
import { LoggerType } from '../types/Logging';

let initialized = false;

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
    await startWindows(getMainWindow, locale, logger);
  } else if (platform === 'darwin') {
    await startMacOS(getMainWindow, locale, logger);
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
