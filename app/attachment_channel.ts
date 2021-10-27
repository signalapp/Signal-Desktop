// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain } from 'electron';
import * as rimraf from 'rimraf';
import {
  getPath,
  getStickersPath,
  getTempPath,
  getDraftPath,
} from '../ts/util/attachments';

let initialized = false;

const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const ERASE_STICKERS_KEY = 'erase-stickers';
const ERASE_TEMP_KEY = 'erase-temp';
const ERASE_DRAFTS_KEY = 'erase-drafts';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';

export function initialize({
  configDir,
  cleanupOrphanedAttachments,
}: {
  configDir: string;
  cleanupOrphanedAttachments: () => Promise<void>;
}): void {
  if (initialized) {
    throw new Error('initialze: Already initialized!');
  }
  initialized = true;

  const attachmentsDir = getPath(configDir);
  const stickersDir = getStickersPath(configDir);
  const tempDir = getTempPath(configDir);
  const draftDir = getDraftPath(configDir);

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

  ipcMain.on(ERASE_DRAFTS_KEY, event => {
    try {
      rimraf.sync(draftDir);
      event.sender.send(`${ERASE_DRAFTS_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`erase drafts error: ${errorForDisplay}`);
      event.sender.send(`${ERASE_DRAFTS_KEY}-done`, error);
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
