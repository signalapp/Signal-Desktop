// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain } from 'electron';
import * as rimraf from 'rimraf';
import {
  getAllAttachments,
  getPath,
  getStickersPath,
  getTempPath,
  getDraftPath,
  deleteAll as deleteAllAttachments,
  deleteAllBadges,
  getAllStickers,
  deleteAllStickers,
  getAllDraftAttachments,
  deleteAllDraftAttachments,
} from './attachments';
import type { MainSQL } from '../ts/sql/main';
import type { MessageAttachmentsCursorType } from '../ts/sql/Interface';
import * as Errors from '../ts/types/errors';
import { sleep } from '../ts/util/sleep';

let initialized = false;

const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const ERASE_STICKERS_KEY = 'erase-stickers';
const ERASE_TEMP_KEY = 'erase-temp';
const ERASE_DRAFTS_KEY = 'erase-drafts';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';

const INTERACTIVITY_DELAY = 50;

type DeleteOrphanedAttachmentsOptionsType = Readonly<{
  orphanedAttachments: Set<string>;
  sql: MainSQL;
  userDataPath: string;
}>;

type CleanupOrphanedAttachmentsOptionsType = Readonly<{
  sql: MainSQL;
  userDataPath: string;
}>;

async function cleanupOrphanedAttachments({
  sql,
  userDataPath,
}: CleanupOrphanedAttachmentsOptionsType): Promise<void> {
  await deleteAllBadges({
    userDataPath,
    pathsToKeep: await sql.sqlCall('getAllBadgeImageFileLocalPaths'),
  });

  const allStickers = await getAllStickers(userDataPath);
  const orphanedStickers = await sql.sqlCall(
    'removeKnownStickers',
    allStickers
  );
  await deleteAllStickers({
    userDataPath,
    stickers: orphanedStickers,
  });

  const allDraftAttachments = await getAllDraftAttachments(userDataPath);
  const orphanedDraftAttachments = await sql.sqlCall(
    'removeKnownDraftAttachments',
    allDraftAttachments
  );
  await deleteAllDraftAttachments({
    userDataPath,
    attachments: orphanedDraftAttachments,
  });

  // Delete orphaned attachments from conversations and messages.

  const orphanedAttachments = new Set(await getAllAttachments(userDataPath));
  console.log(
    'cleanupOrphanedAttachments: found ' +
      `${orphanedAttachments.size} attachments on disk`
  );

  {
    const attachments: ReadonlyArray<string> = await sql.sqlCall(
      'getKnownConversationAttachments'
    );

    let missing = 0;
    for (const known of attachments) {
      if (!orphanedAttachments.delete(known)) {
        missing += 1;
      }
    }

    console.log(
      `cleanupOrphanedAttachments: found ${attachments.length} conversation ` +
        `attachments (${missing} missing), ${orphanedAttachments.size} remain`
    );
  }

  // This call is intentionally not awaited. We block the app while running
  // all fetches above to ensure that there are no in-flight attachments that
  // are saved to disk, but not put into any message or conversation model yet.
  deleteOrphanedAttachments({
    orphanedAttachments,
    sql,
    userDataPath,
  });
}

function deleteOrphanedAttachments({
  orphanedAttachments,
  sql,
  userDataPath,
}: DeleteOrphanedAttachmentsOptionsType): void {
  // This function *can* throw.
  async function runWithPossibleException(): Promise<void> {
    let cursor: MessageAttachmentsCursorType | undefined;
    let totalFound = 0;
    let totalMissing = 0;
    try {
      do {
        let attachments: ReadonlyArray<string>;

        // eslint-disable-next-line no-await-in-loop
        ({ attachments, cursor } = await sql.sqlCall(
          'getKnownMessageAttachments',
          cursor
        ));

        totalFound += attachments.length;

        for (const known of attachments) {
          if (!orphanedAttachments.delete(known)) {
            totalMissing += 1;
          }
        }

        if (cursor === undefined) {
          break;
        }

        // Let other SQL calls come through. There are hundreds of thousands of
        // messages in the database and it might take time to go through them all.
        // eslint-disable-next-line no-await-in-loop
        await sleep(INTERACTIVITY_DELAY);
      } while (cursor !== undefined && !cursor.done);
    } finally {
      if (cursor !== undefined) {
        await sql.sqlCall('finishGetKnownMessageAttachments', cursor);
      }
    }

    console.log(
      `cleanupOrphanedAttachments: found ${totalFound} message ` +
        `attachments, (${totalMissing} missing) ` +
        `${orphanedAttachments.size} remain`
    );

    await deleteAllAttachments({
      userDataPath,
      attachments: Array.from(orphanedAttachments),
    });
  }

  async function runSafe() {
    const start = Date.now();
    try {
      await runWithPossibleException();
    } catch (error) {
      console.error(
        'deleteOrphanedAttachments: error',
        Errors.toLogFormat(error)
      );
    } finally {
      const duration = Date.now() - start;
      console.log(`deleteOrphanedAttachments: took ${duration}ms`);
    }
  }

  // Intentionally not awaiting
  void runSafe();
}

export function initialize({
  configDir,
  sql,
}: {
  configDir: string;
  sql: MainSQL;
}): void {
  if (initialized) {
    throw new Error('initialize: Already initialized!');
  }
  initialized = true;

  const attachmentsDir = getPath(configDir);
  const stickersDir = getStickersPath(configDir);
  const tempDir = getTempPath(configDir);
  const draftDir = getDraftPath(configDir);

  ipcMain.handle(ERASE_TEMP_KEY, () => rimraf.sync(tempDir));
  ipcMain.handle(ERASE_ATTACHMENTS_KEY, () => rimraf.sync(attachmentsDir));
  ipcMain.handle(ERASE_STICKERS_KEY, () => rimraf.sync(stickersDir));
  ipcMain.handle(ERASE_DRAFTS_KEY, () => rimraf.sync(draftDir));

  ipcMain.handle(CLEANUP_ORPHANED_ATTACHMENTS_KEY, async () => {
    const start = Date.now();
    await cleanupOrphanedAttachments({ sql, userDataPath: configDir });
    const duration = Date.now() - start;
    console.log(`cleanupOrphanedAttachments: took ${duration}ms`);
  });
}
