const electron = require('electron');
const Attachments = require('./attachments');
const rimraf = require('rimraf');

const { ipcMain } = electron;

module.exports = {
  initialize,
};

let initialized = false;

const ERASE_ATTACHMENTS_KEY = 'erase-attachments';

async function initialize({ configDir }) {
  if (initialized) {
    throw new Error('initialze: Already initialized!');
  }
  initialized = true;

  console.log('Ensure attachments directory exists');
  await Attachments.ensureDirectory(configDir);

  const attachmentsDir = Attachments.getPath(configDir);

  ipcMain.on(ERASE_ATTACHMENTS_KEY, async event => {
    try {
      rimraf.sync(attachmentsDir);
      event.sender.send(`${ERASE_ATTACHMENTS_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`sql-erase error: ${errorForDisplay}`);
      event.sender.send(`${ERASE_ATTACHMENTS_KEY}-done`, error);
    }
  });
}
