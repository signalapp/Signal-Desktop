import { get as getFromConfig } from 'config';
import { BrowserWindow } from 'electron';
import { start as startUpdater } from './updater';
import { LoggerType, MessagesType } from './common';

let initialized = false;

export async function start(
  getMainWindow: () => BrowserWindow,
  messages?: MessagesType,
  logger?: LoggerType
) {
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
    /*
      If you really want to enable auto-updating in dev mode
      You need to create a dev-app-update.yml file.
      A sample can be found in dev-app-update.yml.sample.
      After that you can change `updatesEnabled` to `true` in the default config.
    */

    logger.info(
      'updater/start: Updates disabled - not starting new version checks'
    );

    return;
  }

  await startUpdater(getMainWindow, messages, logger);
}

function autoUpdateDisabled() {
  return (
    process.mas || !getFromConfig('updatesEnabled') // From Electron: Mac App Store build
  );
}
