import { ipcMain } from 'electron';
import { sqlNode } from './sql';
import { userConfig } from './config/user_config';
import { ephemeralConfig } from './config/ephemeral_config';

let initialized = false;

const SQL_CHANNEL_KEY = 'sql-channel';
const ERASE_SQL_KEY = 'erase-sql-key';
// tslint:disable: no-console

export function initialize() {
  if (initialized) {
    throw new Error('sqlChannels: already initialized!');
  }
  initialized = true;

  ipcMain.on(SQL_CHANNEL_KEY, (event, jobId, callName, ...args) => {
    try {
      const fn = (sqlNode as any)[callName];
      if (!fn) {
        throw new Error(`sql channel: ${callName} is not an available function`);
      }

      const result = fn(...args);

      event.sender.send(`${SQL_CHANNEL_KEY}-done`, jobId, null, result);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`sql channel error with call ${callName}: ${errorForDisplay}`);
    }
  });

  ipcMain.on(ERASE_SQL_KEY, event => {
    try {
      userConfig.remove();
      ephemeralConfig.remove();
      event.sender.send(`${ERASE_SQL_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`sql-erase error: ${errorForDisplay}`);
      event.sender.send(`${ERASE_SQL_KEY}-done`, error);
    }
  });
}
