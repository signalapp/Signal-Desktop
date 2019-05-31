const electron = require('electron');
const Attachments = require('./attachments');
const rimraf = require('rimraf');

const { ipcMain } = electron;

module.exports = {
  initialize,
};

let initialized = false;

const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const ERASE_STICKERS_KEY = 'erase-stickers';
const ERASE_TEMP_KEY = 'erase-temp';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';

async function initialize({ configDir, cleanupOrphanedAttachments }) {
  if (initialized) {
    throw new Error('initialze: Already initialized!');
  }
  initialized = true;

  const attachmentsDir = Attachments.getPath(configDir);
  const stickersDir = Attachments.getStickersPath(configDir);
  const tempDir = Attachments.getTempPath(configDir);

  ipcMain.on(ERASE_TEMP_KEY, event => {
    try {
      rimraf.sync(tempDir);
      event.sender.send(`${ERASE_TEMP_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`erase temp error: ${errorForDisplay}`);
      event.sender.send(`${ERASE_TEMP_KEY}-done`, error);
    }
  });

  ipcMain.on(ERASE_ATTACHMENTS_KEY, event => {
    try {
      rimraf.sync(attachmentsDir);
      event.sender.send(`${ERASE_ATTACHMENTS_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`erase attachments error: ${errorForDisplay}`);
      event.sender.send(`${ERASE_ATTACHMENTS_KEY}-done`, error);
    }
  });

  ipcMain.on(ERASE_STICKERS_KEY, event => {
    try {
      rimraf.sync(stickersDir);
      event.sender.send(`${ERASE_STICKERS_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`erase stickers error: ${errorForDisplay}`);
      event.sender.send(`${ERASE_STICKERS_KEY}-done`, error);
    }
  });

  ipcMain.on(CLEANUP_ORPHANED_ATTACHMENTS_KEY, async event => {
    try {
      await cleanupOrphanedAttachments();
      event.sender.send(`${CLEANUP_ORPHANED_ATTACHMENTS_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`cleanup orphaned attachments error: ${errorForDisplay}`);
      event.sender.send(`${CLEANUP_ORPHANED_ATTACHMENTS_KEY}-done`, error);
    }
  });
}
