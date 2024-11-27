// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion45(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 45) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      --- Add column to messages table

      ALTER TABLE messages ADD COLUMN storyId STRING;

      --- Update important message indices

      DROP INDEX   messages_conversation;
      CREATE INDEX messages_conversation ON messages
        (conversationId, type, storyId, received_at);

      DROP INDEX   messages_unread;
      CREATE INDEX messages_unread ON messages
        (conversationId, readStatus, type, storyId) WHERE readStatus IS NOT NULL;

      --- Update attachment indices for All Media views

      DROP INDEX   messages_hasAttachments;
      CREATE INDEX messages_hasAttachments
        ON messages (conversationId, hasAttachments, received_at)
        WHERE type IS NOT 'story' AND storyId IS NULL;

      DROP INDEX   messages_hasFileAttachments;
      CREATE INDEX messages_hasFileAttachments
        ON messages (conversationId, hasFileAttachments, received_at)
        WHERE type IS NOT 'story' AND storyId IS NULL;

      DROP INDEX   messages_hasVisualMediaAttachments;
      CREATE INDEX messages_hasVisualMediaAttachments
        ON messages (conversationId, hasVisualMediaAttachments, received_at)
        WHERE type IS NOT 'story' AND storyId IS NULL;

      --- Message insert/update triggers to exclude stories and story replies

      DROP   TRIGGER messages_on_insert;
      -- Note: any changes to this trigger must be reflected in 
      -- Server.ts: enableMessageInsertTriggersAndBackfill
      CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
      WHEN new.isViewOnce IS NOT 1 AND new.storyId IS NULL
      BEGIN
        INSERT INTO messages_fts
          (rowid, body)
        VALUES
          (new.rowid, new.body);
      END;

      DROP   TRIGGER messages_on_update;
      CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
      WHEN
        (new.body IS NULL OR old.body IS NOT new.body) AND
         new.isViewOnce IS NOT 1 AND new.storyId IS NULL
      BEGIN
        DELETE FROM messages_fts WHERE rowid = old.rowid;
        INSERT INTO messages_fts
          (rowid, body)
        VALUES
          (new.rowid, new.body);
      END;

      --- Update delete trigger to remove storyReads

      --- Note: for future updates to this trigger, be sure to update Server.ts/removeAll()
      ---       (it deletes and re-adds this trigger for performance)
      DROP   TRIGGER messages_on_delete;
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
        DELETE FROM storyReads WHERE storyId = old.storyId;
      END;

      --- Story Read History

      CREATE TABLE storyReads (
        authorId STRING NOT NULL,
        conversationId STRING NOT NULL,
        storyId STRING NOT NULL,
        storyReadDate NUMBER NOT NULL,

        PRIMARY KEY (authorId, storyId)
      );

      CREATE INDEX storyReads_data ON storyReads (
        storyReadDate, authorId, conversationId
      );

      --- Story Distribution Lists

      CREATE TABLE storyDistributions(
        id STRING PRIMARY KEY NOT NULL,
        name TEXT,

        avatarUrlPath TEXT,
        avatarKey BLOB,
        senderKeyInfoJson STRING
      );

      CREATE TABLE storyDistributionMembers(
        listId STRING NOT NULL REFERENCES storyDistributions(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        uuid STRING NOT NULL,

        PRIMARY KEY (listId, uuid)
      )
      `
    );

    db.pragma('user_version = 45');
  })();

  logger.info('updateToSchemaVersion45: success!');
}
