import path from 'path';
import { ipcMain } from 'electron';
import { isString, map } from 'lodash';
import rimraf from 'rimraf';
import fse from 'fs-extra';
import pify from 'pify';
// eslint-disable-next-line import/no-named-default
import { default as glob } from 'glob';

import { sqlNode } from './sql'; // checked - only node
import { createDeleter, getAttachmentsPath } from '../shared/attachments/shared_attachments';

let initialized = false;

const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';

//      ensureDirectory :: AbsolutePath -> IO Unit
const ensureDirectory = async (userDataPath: string) => {
  if (!isString(userDataPath)) {
    throw new TypeError("'userDataPath' must be a string");
  }
  await fse.ensureDir(getAttachmentsPath(userDataPath));
};

const deleteAll = async ({
  userDataPath,
  attachments,
}: {
  userDataPath: string;
  attachments: any;
}) => {
  const deleteFromDisk = createDeleter(getAttachmentsPath(userDataPath));

  for (let index = 0, max = attachments.length; index < max; index += 1) {
    const file = attachments[index];
    // eslint-disable-next-line no-await-in-loop
    await deleteFromDisk(file);
  }

  console.log(`deleteAll: deleted ${attachments.length} files`);
};

const getAllAttachments = async (userDataPath: string) => {
  const dir = getAttachmentsPath(userDataPath);
  const pattern = path.join(dir, '**', '*');

  const files = await pify(glob)(pattern, { nodir: true });
  return map(files, file => path.relative(dir, file));
};

async function cleanupOrphanedAttachments(userDataPath: string) {
  const allAttachments = await getAllAttachments(userDataPath);
  const orphanedAttachments = sqlNode.removeKnownAttachments(allAttachments);
  await deleteAll({
    userDataPath,
    attachments: orphanedAttachments,
  });
}

export async function initAttachmentsChannel({ userDataPath }: { userDataPath: string }) {
  if (initialized) {
    throw new Error('initialze: Already initialized!');
  }
  initialized = true;

  console.log('Ensure attachments directory exists');
  await ensureDirectory(userDataPath);

  const attachmentsDir = getAttachmentsPath(userDataPath);

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

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  ipcMain.on(CLEANUP_ORPHANED_ATTACHMENTS_KEY, async event => {
    try {
      await cleanupOrphanedAttachments(userDataPath);
      event.sender.send(`${CLEANUP_ORPHANED_ATTACHMENTS_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`cleanup orphaned attachments error: ${errorForDisplay}`);
      event.sender.send(`${CLEANUP_ORPHANED_ATTACHMENTS_KEY}-done`, error);
    }
  });
}
