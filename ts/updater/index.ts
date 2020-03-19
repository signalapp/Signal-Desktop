import { get as getFromConfig } from 'config';
import { BrowserWindow } from 'electron';
import { start as startUpdater, stop as stopUpdater } from './updater';
import { LoggerType, MessagesType } from './common';
import { UserConfig } from '../../app/user_config';

let initialized = false;
let config: UserConfig;

export async function start(
  getMainWindow: () => BrowserWindow,
  userConfig: UserConfig,
  messages?: MessagesType,
  logger?: LoggerType
) {
  if (initialized) {
    throw new Error('updater/start: Updates have already been initialized!');
  }
  initialized = true;
  config = userConfig;

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

export function stop() {
  if (initialized) {
    stopUpdater();
    initialized = false;
  }
}

function autoUpdateDisabled() {
  return (
    process.mas || // From Electron: Mac App Store build
    !getFromConfig('updatesEnabled') || // Hard coded config
    // tslint:disable-next-line: no-backbone-get-set-outside-model
    !config.get('autoUpdate') // User setting
  );
}
