const electron = require('electron');
const sql = require('./sql');

const { ipcMain } = electron;

module.exports = {
  initialize,
};

let initialized = false;

const SQL_CHANNEL_KEY = 'sql-channel';
const ERASE_SQL_KEY = 'erase-sql-key';

function initialize({ userConfig }) {
  if (initialized) {
    throw new Error('sqlChannels: already initialized!');
  }
  initialized = true;

  if (!userConfig) {
    throw new Error('initialize: userConfig is required!');
  }

  ipcMain.on(SQL_CHANNEL_KEY, async (event, jobId, callName, ...args) => {
    try {
      const fn = sql[callName];
      if (!fn) {
        throw new Error(
          `sql channel: ${callName} is not an available function`
        );
      }

      const result = await fn(...args);
      event.sender.send(`${SQL_CHANNEL_KEY}-done`, jobId, null, result);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(
        `sql channel error with call ${callName}: ${errorForDisplay}`
      );
      event.sender.send(`${SQL_CHANNEL_KEY}-done`, jobId, errorForDisplay);
    }
  });

  ipcMain.on(ERASE_SQL_KEY, async event => {
    try {
      userConfig.set('key', null);
      event.sender.send(`${ERASE_SQL_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`sql-erase error: ${errorForDisplay}`);
      event.sender.send(`${ERASE_SQL_KEY}-done`, error);
    }
  });
}
