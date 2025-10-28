// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { batchMultiVarQuery } from '../util.std.js';
import type { WritableDB } from '../Interface.std.js';
import type { LoggerType } from '../../types/Logging.std.js';

export default function updateToSchemaVersion42(
  db: WritableDB,
  logger: LoggerType
): void {
  // First, recreate messages table delete trigger with reaction support

  db.exec(`
    DROP TRIGGER messages_on_delete;

    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      DELETE FROM sendLogPayloads WHERE id IN (
        SELECT payloadId FROM sendLogMessageIds
        WHERE messageId = old.id
      );
      DELETE FROM reactions WHERE rowid IN (
        SELECT rowid FROM reactions
        WHERE messageId = old.id
      );
    END;
  `);

  // Then, delete previously-orphaned reactions

  // Note: we use `pluck` here to fetch only the first column of
  //   returned row.
  const messageIdList: Array<string> = db
    .prepare('SELECT id FROM messages ORDER BY id ASC;', {
      pluck: true,
    })
    .all();
  const allReactions: Array<{
    rowid: number;
    messageId: string;
  }> = db.prepare('SELECT rowid, messageId FROM reactions;').all();

  const messageIds = new Set(messageIdList);
  const reactionsToDelete: Array<number> = [];

  allReactions.forEach(reaction => {
    if (!messageIds.has(reaction.messageId)) {
      reactionsToDelete.push(reaction.rowid);
    }
  });

  function deleteReactions(rowids: ReadonlyArray<number>, persistent: boolean) {
    db.prepare(
      `
      DELETE FROM reactions
      WHERE rowid IN ( ${rowids.map(() => '?').join(', ')} );
      `,
      { persistent }
    ).run(rowids);
  }

  if (reactionsToDelete.length > 0) {
    logger.info(`Deleting ${reactionsToDelete.length} orphaned reactions`);
    batchMultiVarQuery(db, reactionsToDelete, deleteReactions);
  }
}
