// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';
import lodash from 'lodash';
import { v4 as generateUuid } from 'uuid';

import type { LoggerType } from '../../types/Logging.std.js';
import {
  getSchemaVersion,
  getUserVersion,
  getSQLCipherVersion,
  getSQLiteVersion,
  objectToJSON,
  jsonToObject,
} from '../util.std.js';
import type { WritableDB } from '../Interface.std.js';

import updateToSchemaVersion41 from './41-uuid-keys.std.js';
import updateToSchemaVersion42 from './42-stale-reactions.std.js';
import updateToSchemaVersion43 from './43-gv2-uuid.std.js';
import updateToSchemaVersion44 from './44-badges.std.js';
import updateToSchemaVersion45 from './45-stories.std.js';
import updateToSchemaVersion46 from './46-optimize-stories.std.js';
import updateToSchemaVersion47 from './47-further-optimize.std.js';
import updateToSchemaVersion48 from './48-fix-user-initiated-index.std.js';
import updateToSchemaVersion49 from './49-fix-preview-index.std.js';
import updateToSchemaVersion50 from './50-fix-messages-unread-index.std.js';
import updateToSchemaVersion51 from './51-centralize-conversation-jobs.node.js';
import updateToSchemaVersion52 from './52-optimize-stories.std.js';
import updateToSchemaVersion53 from './53-gv2-banned-members.std.js';
import updateToSchemaVersion54 from './54-unprocessed-received-at-counter.std.js';
import updateToSchemaVersion55 from './55-report-message-aci.node.js';
import updateToSchemaVersion56 from './56-add-unseen-to-message.std.js';
import updateToSchemaVersion57 from './57-rm-message-history-unsynced.std.js';
import updateToSchemaVersion58 from './58-update-unread.std.js';
import updateToSchemaVersion59 from './59-unprocessed-received-at-counter-index.std.js';
import updateToSchemaVersion60 from './60-update-expiring-index.std.js';
import updateToSchemaVersion61 from './61-distribution-list-storage.std.js';
import updateToSchemaVersion62 from './62-add-urgent-to-send-log.std.js';
import updateToSchemaVersion63 from './63-add-urgent-to-unprocessed.std.js';
import updateToSchemaVersion64 from './64-uuid-column-for-pre-keys.std.js';
import updateToSchemaVersion65 from './65-add-storage-id-to-stickers.std.js';
import updateToSchemaVersion66 from './66-add-pni-signature-to-sent-protos.std.js';
import updateToSchemaVersion67 from './67-add-story-to-unprocessed.std.js';
import updateToSchemaVersion68 from './68-drop-deprecated-columns.std.js';
import updateToSchemaVersion69 from './69-group-call-ring-cancellations.std.js';
import updateToSchemaVersion70 from './70-story-reply-index.std.js';
import updateToSchemaVersion71 from './71-merge-notifications.std.js';
import updateToSchemaVersion72 from './72-optimize-call-id-message-lookup.std.js';
import updateToSchemaVersion73 from './73-remove-phone-number-discovery.std.js';
import updateToSchemaVersion74 from './74-optimize-convo-open.std.js';
import updateToSchemaVersion75 from './75-noop.std.js';
import updateToSchemaVersion76 from './76-optimize-convo-open-2.std.js';
import updateToSchemaVersion77 from './77-signal-tokenizer.std.js';
import updateToSchemaVersion78 from './78-merge-receipt-jobs.node.js';
import updateToSchemaVersion79 from './79-paging-lightbox.std.js';
import updateToSchemaVersion80 from './80-edited-messages.std.js';
import updateToSchemaVersion81 from './81-contact-removed-notification.std.js';
import updateToSchemaVersion82 from './82-edited-messages-read-index.std.js';
import updateToSchemaVersion83 from './83-mentions.std.js';
import updateToSchemaVersion84 from './84-all-mentions.std.js';
import updateToSchemaVersion85 from './85-add-kyber-keys.std.js';
import updateToSchemaVersion86 from './86-story-replies-index.std.js';
import updateToSchemaVersion87 from './87-cleanup.std.js';
import updateToSchemaVersion88 from './88-service-ids.std.js';
import updateToSchemaVersion89 from './89-call-history.node.js';
import updateToSchemaVersion90 from './90-delete-story-reply-screenshot.std.js';
import updateToSchemaVersion91 from './91-clean-keys.std.js';
import updateToSchemaVersion920 from './920-clean-more-keys.std.js';
import updateToSchemaVersion930 from './930-fts5-secure-delete.std.js';
import updateToSchemaVersion940 from './940-fts5-revert.std.js';
import updateToSchemaVersion950 from './950-fts5-secure-delete.std.js';
import updateToSchemaVersion960 from './960-untag-pni.std.js';
import updateToSchemaVersion970 from './970-fts5-optimize.std.js';
import updateToSchemaVersion980 from './980-reaction-timestamp.std.js';
import updateToSchemaVersion990 from './990-phone-number-sharing.std.js';
import updateToSchemaVersion1000 from './1000-mark-unread-call-history-messages-as-unseen.std.js';
import updateToSchemaVersion1010 from './1010-call-links-table.std.js';
import updateToSchemaVersion1020 from './1020-self-merges.std.js';
import updateToSchemaVersion1030 from './1030-unblock-event.std.js';
import updateToSchemaVersion1040 from './1040-undownloaded-backed-up-media.std.js';
import updateToSchemaVersion1050 from './1050-group-send-endorsements.std.js';
import updateToSchemaVersion1060 from './1060-addressable-messages-and-sync-tasks.std.js';
import updateToSchemaVersion1070 from './1070-attachment-backup.std.js';
import updateToSchemaVersion1080 from './1080-nondisappearing-addressable.std.js';
import updateToSchemaVersion1090 from './1090-message-delete-indexes.std.js';
import updateToSchemaVersion1100 from './1100-optimize-mark-call-history-read-in-conversation.std.js';
import updateToSchemaVersion1110 from './1110-sticker-local-key.std.js';
import updateToSchemaVersion1120 from './1120-messages-foreign-keys-indexes.std.js';
import updateToSchemaVersion1130 from './1130-isStory-index.std.js';
import updateToSchemaVersion1140 from './1140-call-links-deleted-column.std.js';
import updateToSchemaVersion1150 from './1150-expire-timer-version.std.js';
import updateToSchemaVersion1160 from './1160-optimize-calls-unread-count.std.js';
import updateToSchemaVersion1170 from './1170-update-call-history-unread-index.std.js';
import updateToSchemaVersion1180 from './1180-add-attachment-download-source.std.js';
import updateToSchemaVersion1190 from './1190-call-links-storage.std.js';
import updateToSchemaVersion1200 from './1200-attachment-download-source-index.std.js';
import updateToSchemaVersion1210 from './1210-call-history-started-id.std.js';
import updateToSchemaVersion1220 from './1220-blob-sessions.node.js';
import updateToSchemaVersion1230 from './1230-call-links-admin-key-index.std.js';
import updateToSchemaVersion1240 from './1240-defunct-call-links-table.std.js';
import updateToSchemaVersion1250 from './1250-defunct-call-links-storage.std.js';
import updateToSchemaVersion1260 from './1260-sync-tasks-rowid.std.js';
import updateToSchemaVersion1270 from './1270-normalize-messages.std.js';
import updateToSchemaVersion1280 from './1280-blob-unprocessed.std.js';
import updateToSchemaVersion1290 from './1290-int-unprocessed-source-device.std.js';
import updateToSchemaVersion1300 from './1300-sticker-pack-refs.std.js';
import updateToSchemaVersion1310 from './1310-muted-fixup.std.js';
import updateToSchemaVersion1320 from './1320-unprocessed-received-at-date.std.js';
import updateToSchemaVersion1330 from './1330-sync-tasks-type-index.std.js';
import updateToSchemaVersion1340 from './1340-recent-gifs.std.js';
import updateToSchemaVersion1350 from './1350-notification-profiles.std.js';
import updateToSchemaVersion1360 from './1360-attachments.std.js';
import updateToSchemaVersion1370 from './1370-message-attachment-indexes.std.js';
import updateToSchemaVersion1380 from './1380-donation-receipts.std.js';
import updateToSchemaVersion1390 from './1390-attachment-download-keys.std.js';
import updateToSchemaVersion1400 from './1400-simplify-receipts.std.js';
import updateToSchemaVersion1410 from './1410-remove-wallpaper.std.js';
import updateToSchemaVersion1420 from './1420-backup-downloads.std.js';
import updateToSchemaVersion1430 from './1430-call-links-epoch-id.std.js';
import updateToSchemaVersion1440 from './1440-chat-folders.std.js';
import updateToSchemaVersion1450 from './1450-all-media.std.js';
import updateToSchemaVersion1460 from './1460-attachment-duration.std.js';
import updateToSchemaVersion1470 from './1470-kyber-triple.std.js';
import updateToSchemaVersion1480 from './1480-chat-folders-remove-duplicates.std.js';
import updateToSchemaVersion1490 from './1490-lowercase-notification-profiles.std.js';

import { DataWriter } from '../Server.node.js';

const { keyBy } = lodash;

function updateToSchemaVersion1(db: Database): void {
  db.exec(`
    CREATE TABLE messages(
      id STRING PRIMARY KEY ASC,
      json TEXT,

      unread INTEGER,
      expires_at INTEGER,
      sent_at INTEGER,
      schemaVersion INTEGER,
      conversationId STRING,
      received_at INTEGER,
      source STRING,
      sourceDevice STRING,
      hasAttachments INTEGER,
      hasFileAttachments INTEGER,
      hasVisualMediaAttachments INTEGER
    );
    CREATE INDEX messages_unread ON messages (
      unread
    );
    CREATE INDEX messages_expires_at ON messages (
      expires_at
    );
    CREATE INDEX messages_receipt ON messages (
      sent_at
    );
    CREATE INDEX messages_schemaVersion ON messages (
      schemaVersion
    );
    CREATE INDEX messages_conversation ON messages (
      conversationId,
      received_at
    );
    CREATE INDEX messages_duplicate_check ON messages (
      source,
      sourceDevice,
      sent_at
    );
    CREATE INDEX messages_hasAttachments ON messages (
      conversationId,
      hasAttachments,
      received_at
    );
    CREATE INDEX messages_hasFileAttachments ON messages (
      conversationId,
      hasFileAttachments,
      received_at
    );
    CREATE INDEX messages_hasVisualMediaAttachments ON messages (
      conversationId,
      hasVisualMediaAttachments,
      received_at
    );
    CREATE TABLE unprocessed(
      id STRING,
      timestamp INTEGER,
      json TEXT
    );
    CREATE INDEX unprocessed_id ON unprocessed (
      id
    );
    CREATE INDEX unprocessed_timestamp ON unprocessed (
      timestamp
    );
  `);
}

function updateToSchemaVersion2(db: Database): void {
  db.exec(`
    ALTER TABLE messages
      ADD COLUMN expireTimer INTEGER;

    ALTER TABLE messages
      ADD COLUMN expirationStartTimestamp INTEGER;

    ALTER TABLE messages
      ADD COLUMN type STRING;

    CREATE INDEX messages_expiring ON messages (
      expireTimer,
      expirationStartTimestamp,
      expires_at
    );

    UPDATE messages SET
      expirationStartTimestamp = json_extract(json, '$.expirationStartTimestamp'),
      expireTimer = json_extract(json, '$.expireTimer'),
      type = json_extract(json, '$.type');
  `);
}

function updateToSchemaVersion3(db: Database): void {
  db.exec(`
    DROP INDEX messages_expiring;
    DROP INDEX messages_unread;

    CREATE INDEX messages_without_timer ON messages (
      expireTimer,
      expires_at,
      type
    ) WHERE expires_at IS NULL AND expireTimer IS NOT NULL;

    CREATE INDEX messages_unread ON messages (
      conversationId,
      unread
    ) WHERE unread IS NOT NULL;

    ANALYZE;
  `);
}

function updateToSchemaVersion4(db: Database): void {
  db.exec(`
    CREATE TABLE conversations(
      id STRING PRIMARY KEY ASC,
      json TEXT,

      active_at INTEGER,
      type STRING,
      members TEXT,
      name TEXT,
      profileName TEXT
    );
    CREATE INDEX conversations_active ON conversations (
      active_at
    ) WHERE active_at IS NOT NULL;

    CREATE INDEX conversations_type ON conversations (
      type
    ) WHERE type IS NOT NULL;
  `);
}

function updateToSchemaVersion6(db: Database): void {
  db.exec(`
    -- key-value, ids are strings, one extra column
    CREATE TABLE sessions(
      id STRING PRIMARY KEY ASC,
      number STRING,
      json TEXT
    );
    CREATE INDEX sessions_number ON sessions (
      number
    ) WHERE number IS NOT NULL;
    -- key-value, ids are strings
    CREATE TABLE groups(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );
    CREATE TABLE identityKeys(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );
    CREATE TABLE items(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );
    -- key-value, ids are integers
    CREATE TABLE preKeys(
      id INTEGER PRIMARY KEY ASC,
      json TEXT
    );
    CREATE TABLE signedPreKeys(
      id INTEGER PRIMARY KEY ASC,
      json TEXT
    );
  `);
}

function updateToSchemaVersion7(db: Database): void {
  db.exec(`
    -- SQLite has been coercing our STRINGs into numbers, so we force it with TEXT
    -- We create a new table then copy the data into it, since we can't modify columns
    DROP INDEX sessions_number;
    ALTER TABLE sessions RENAME TO sessions_old;

    CREATE TABLE sessions(
      id TEXT PRIMARY KEY,
      number TEXT,
      json TEXT
    );
    CREATE INDEX sessions_number ON sessions (
      number
    ) WHERE number IS NOT NULL;
    INSERT INTO sessions(id, number, json)
      SELECT '+' || id, number, json FROM sessions_old;
    DROP TABLE sessions_old;
  `);
}

function updateToSchemaVersion8(db: Database): void {
  db.exec(`
    -- First, we pull a new body field out of the message table's json blob
    ALTER TABLE messages
      ADD COLUMN body TEXT;
    UPDATE messages SET body = json_extract(json, '$.body');

    -- Then we create our full-text search table and populate it
    CREATE VIRTUAL TABLE messages_fts
      USING fts5(id UNINDEXED, body);

    INSERT INTO messages_fts(id, body)
      SELECT id, body FROM messages;

    -- Then we set up triggers to keep the full-text search table up to date
    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts (
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
    END;
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
      INSERT INTO messages_fts(
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
  `);

  // For formatting search results:
  //   https://sqlite.org/fts5.html#the_highlight_function
  //   https://sqlite.org/fts5.html#the_snippet_function
}

function updateToSchemaVersion9(db: Database): void {
  db.exec(`
    CREATE TABLE attachment_downloads(
      id STRING primary key,
      timestamp INTEGER,
      pending INTEGER,
      json TEXT
    );

    CREATE INDEX attachment_downloads_timestamp
      ON attachment_downloads (
        timestamp
    ) WHERE pending = 0;
    CREATE INDEX attachment_downloads_pending
      ON attachment_downloads (
        pending
    ) WHERE pending != 0;
  `);
}

function updateToSchemaVersion10(db: Database): void {
  db.exec(`
    DROP INDEX unprocessed_id;
    DROP INDEX unprocessed_timestamp;
    ALTER TABLE unprocessed RENAME TO unprocessed_old;

    CREATE TABLE unprocessed(
      id STRING,
      timestamp INTEGER,
      version INTEGER,
      attempts INTEGER,
      envelope TEXT,
      decrypted TEXT,
      source TEXT,
      sourceDevice TEXT,
      serverTimestamp INTEGER
    );

    CREATE INDEX unprocessed_id ON unprocessed (
      id
    );
    CREATE INDEX unprocessed_timestamp ON unprocessed (
      timestamp
    );

    INSERT INTO unprocessed (
      id,
      timestamp,
      version,
      attempts,
      envelope,
      decrypted,
      source,
      sourceDevice,
      serverTimestamp
    ) SELECT
      id,
      timestamp,
      json_extract(json, '$.version'),
      json_extract(json, '$.attempts'),
      json_extract(json, '$.envelope'),
      json_extract(json, '$.decrypted'),
      json_extract(json, '$.source'),
      json_extract(json, '$.sourceDevice'),
      json_extract(json, '$.serverTimestamp')
    FROM unprocessed_old;

    DROP TABLE unprocessed_old;
  `);
}

function updateToSchemaVersion11(db: Database): void {
  db.exec(`
    DROP TABLE groups;
  `);
}

function updateToSchemaVersion12(db: Database): void {
  db.exec(`
    CREATE TABLE sticker_packs(
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,

      author STRING,
      coverStickerId INTEGER,
      createdAt INTEGER,
      downloadAttempts INTEGER,
      installedAt INTEGER,
      lastUsed INTEGER,
      status STRING,
      stickerCount INTEGER,
      title STRING
    );

    CREATE TABLE stickers(
      id INTEGER NOT NULL,
      packId TEXT NOT NULL,

      emoji STRING,
      height INTEGER,
      isCoverOnly INTEGER,
      lastUsed INTEGER,
      path STRING,
      width INTEGER,

      PRIMARY KEY (id, packId),
      CONSTRAINT stickers_fk
        FOREIGN KEY (packId)
        REFERENCES sticker_packs(id)
        ON DELETE CASCADE
    );

    CREATE INDEX stickers_recents
      ON stickers (
        lastUsed
    ) WHERE lastUsed IS NOT NULL;

    CREATE TABLE sticker_references(
      messageId STRING,
      packId TEXT,
      CONSTRAINT sticker_references_fk
        FOREIGN KEY(packId)
        REFERENCES sticker_packs(id)
        ON DELETE CASCADE
    );
  `);
}

function updateToSchemaVersion13(db: Database): void {
  db.exec(`
    ALTER TABLE sticker_packs ADD COLUMN attemptedStatus STRING;
  `);
}

function updateToSchemaVersion14(db: Database): void {
  db.exec(`
    CREATE TABLE emojis(
      shortName STRING PRIMARY KEY,
      lastUsage INTEGER
    );

    CREATE INDEX emojis_lastUsage
      ON emojis (
        lastUsage
    );
  `);
}

function updateToSchemaVersion15(db: Database): void {
  db.exec(`
    -- SQLite has again coerced our STRINGs into numbers, so we force it with TEXT
    -- We create a new table then copy the data into it, since we can't modify columns

    DROP INDEX emojis_lastUsage;
    ALTER TABLE emojis RENAME TO emojis_old;

    CREATE TABLE emojis(
      shortName TEXT PRIMARY KEY,
      lastUsage INTEGER
    );
    CREATE INDEX emojis_lastUsage
      ON emojis (
        lastUsage
    );

    DELETE FROM emojis WHERE shortName = 1;
    INSERT INTO emojis(shortName, lastUsage)
      SELECT shortName, lastUsage FROM emojis_old;

    DROP TABLE emojis_old;
  `);
}

function updateToSchemaVersion16(db: Database): void {
  db.exec(`
    ALTER TABLE messages
    ADD COLUMN messageTimer INTEGER;
    ALTER TABLE messages
    ADD COLUMN messageTimerStart INTEGER;
    ALTER TABLE messages
    ADD COLUMN messageTimerExpiresAt INTEGER;
    ALTER TABLE messages
    ADD COLUMN isErased INTEGER;

    CREATE INDEX messages_message_timer ON messages (
      messageTimer,
      messageTimerStart,
      messageTimerExpiresAt,
      isErased
    ) WHERE messageTimer IS NOT NULL;

    -- Updating full-text triggers to avoid anything with a messageTimer set

    DROP TRIGGER messages_on_insert;
    DROP TRIGGER messages_on_delete;
    DROP TRIGGER messages_on_update;

    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.messageTimer IS NULL
    BEGIN
      INSERT INTO messages_fts (
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
    END;
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN new.messageTimer IS NULL
    BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
      INSERT INTO messages_fts(
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
  `);
}

function updateToSchemaVersion17(db: Database, logger: LoggerType): void {
  try {
    db.exec(`
      ALTER TABLE messages
      ADD COLUMN isViewOnce INTEGER;

      DROP INDEX messages_message_timer;
    `);
  } catch (error) {
    logger.info('Message table already had isViewOnce column');
  }

  db.exec('DROP INDEX IF EXISTS messages_view_once;');

  db.exec(`
    CREATE INDEX messages_view_once ON messages (
      isErased
    ) WHERE isViewOnce = 1;

    -- Updating full-text triggers to avoid anything with isViewOnce = 1

    DROP TRIGGER messages_on_insert;
    DROP TRIGGER messages_on_update;

    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.isViewOnce != 1
    BEGIN
      INSERT INTO messages_fts (
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN new.isViewOnce != 1
    BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
      INSERT INTO messages_fts(
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
  `);
}

function updateToSchemaVersion18(db: Database): void {
  db.exec(`
    -- Delete and rebuild full-text search index to capture everything

    DELETE FROM messages_fts;
    INSERT INTO messages_fts(messages_fts) VALUES('rebuild');

    INSERT INTO messages_fts(id, body)
    SELECT id, body FROM messages WHERE isViewOnce IS NULL OR isViewOnce != 1;

    -- Fixing full-text triggers

    DROP TRIGGER messages_on_insert;
    DROP TRIGGER messages_on_update;

    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
    BEGIN
      INSERT INTO messages_fts (
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
    BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
      INSERT INTO messages_fts(
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
  `);
}

function updateToSchemaVersion19(db: Database): void {
  db.exec(`
    ALTER TABLE conversations
    ADD COLUMN profileFamilyName TEXT;
    ALTER TABLE conversations
    ADD COLUMN profileFullName TEXT;

    -- Preload new field with the profileName we already have
    UPDATE conversations SET profileFullName = profileName;
  `);
}

function updateToSchemaVersion20(db: Database): void {
  // The triggers on the messages table slow down this migration
  // significantly, so we drop them and recreate them later.
  // Drop triggers
  const triggers = db
    .prepare(
      "SELECT * FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'messages'"
    )
    .all<{ name: string; sql: string }>();

  for (const trigger of triggers) {
    db.exec(`DROP TRIGGER ${trigger.name}`);
  }

  // Create new columns and indices
  db.exec(`
    ALTER TABLE conversations ADD COLUMN e164 TEXT;
    ALTER TABLE conversations ADD COLUMN uuid TEXT;
    ALTER TABLE conversations ADD COLUMN groupId TEXT;
    ALTER TABLE messages ADD COLUMN sourceUuid TEXT;
    ALTER TABLE sessions RENAME COLUMN number TO conversationId;
    CREATE INDEX conversations_e164 ON conversations(e164);
    CREATE INDEX conversations_uuid ON conversations(uuid);
    CREATE INDEX conversations_groupId ON conversations(groupId);
    CREATE INDEX messages_sourceUuid on messages(sourceUuid);

    -- Migrate existing IDs
    UPDATE conversations SET e164 = '+' || id WHERE type = 'private';
    UPDATE conversations SET groupId = id WHERE type = 'group';
  `);

  // Drop invalid groups and any associated messages
  const maybeInvalidGroups = db
    .prepare(
      "SELECT * FROM conversations WHERE type = 'group' AND members IS NULL;"
    )
    .all<{ id: string; json: string }>();
  for (const group of maybeInvalidGroups) {
    const json: { id: string; members: Array<unknown> } = JSON.parse(
      group.json
    );
    if (!json.members || !json.members.length) {
      db.prepare('DELETE FROM conversations WHERE id = $id;').run({
        id: json.id,
      });
      db.prepare('DELETE FROM messages WHERE conversationId = $id;').run({
        id: json.id,
      });
    }
  }

  // Generate new IDs and alter data
  const allConversations = db.prepare('SELECT * FROM conversations;').all<{
    id: string;
    type: string;
  }>();
  const allConversationsByOldId = keyBy(allConversations, 'id');

  for (const row of allConversations) {
    const oldId = row.id;
    const newId = generateUuid();
    allConversationsByOldId[oldId].id = newId;
    const patchObj: { id: string; e164?: string; groupId?: string } = {
      id: newId,
    };
    if (row.type === 'private') {
      patchObj.e164 = `+${oldId}`;
    } else if (row.type === 'group') {
      patchObj.groupId = oldId;
    }
    const patch = JSON.stringify(patchObj);

    db.prepare(
      `
      UPDATE conversations
      SET id = $newId, json = JSON_PATCH(json, $patch)
      WHERE id = $oldId
      `
    ).run({
      newId,
      oldId,
      patch,
    });
    const messagePatch = JSON.stringify({ conversationId: newId });
    db.prepare(
      `
      UPDATE messages
      SET conversationId = $newId, json = JSON_PATCH(json, $patch)
      WHERE conversationId = $oldId
      `
    ).run({ newId, oldId, patch: messagePatch });
  }

  const groupConversations: Array<{
    id: string;
    members: string;
    json: string;
  }> = db
    .prepare(
      `
      SELECT id, members, json FROM conversations WHERE type = 'group';
      `
    )
    .all();

  // Update group conversations, point members at new conversation ids
  groupConversations.forEach(groupRow => {
    const members = groupRow.members.split(/\s?\+/).filter(Boolean);
    const newMembers = [];
    for (const m of members) {
      const memberRow = allConversationsByOldId[m];

      if (memberRow) {
        newMembers.push(memberRow.id);
      } else {
        // We didn't previously have a private conversation for this member,
        // we need to create one
        const id = generateUuid();
        const updatedConversation = {
          id,
          e164: m,
          type: 'private',
          version: 2,
          unreadCount: 0,
          verified: 0,

          // Not directly used by saveConversation, but are necessary
          // for conversation model
          inbox_position: 0,
          isPinned: false,
          lastMessageDeletedForEveryone: false,
          markedUnread: false,
          messageCount: 0,
          sentMessageCount: 0,
          profileSharing: false,
        };

        db.prepare(
          `
          UPDATE conversations
          SET
            json = $json,
            e164 = $e164,
            type = $type
          WHERE
            id = $id;
          `
        ).run({
          id: updatedConversation.id,
          json: objectToJSON(updatedConversation),
          e164: updatedConversation.e164,
          type: updatedConversation.type,
        });

        newMembers.push(id);
      }
    }
    const json = {
      ...jsonToObject<Record<string, unknown>>(groupRow.json),
      members: newMembers,
    };
    const newMembersValue = newMembers.join(' ');
    db.prepare(
      `
      UPDATE conversations
      SET members = $newMembersValue, json = $newJsonValue
      WHERE id = $id
      `
    ).run({
      id: groupRow.id,
      newMembersValue,
      newJsonValue: objectToJSON(json),
    });
  });

  // Update sessions to stable IDs
  const allSessions = db.prepare('SELECT * FROM sessions;').all<{
    id: string;
    json: string;
  }>();
  for (const session of allSessions) {
    // Not using patch here so we can explicitly delete a property rather than
    // implicitly delete via null
    const newJson = JSON.parse(session.json);
    const conversation = allConversationsByOldId[newJson.number.substr(1)];
    if (conversation) {
      newJson.conversationId = conversation.id;
      newJson.id = `${newJson.conversationId}.${newJson.deviceId}`;
    }
    delete newJson.number;
    db.prepare(
      `
      UPDATE sessions
      SET id = $newId, json = $newJson, conversationId = $newConversationId
      WHERE id = $oldId
      `
    ).run({
      newId: newJson.id,
      newJson: objectToJSON(newJson),
      oldId: session.id,
      newConversationId: newJson.conversationId,
    });
  }

  // Update identity keys to stable IDs
  const allIdentityKeys = db.prepare('SELECT * FROM identityKeys;').all<{
    json: string;
    id: number;
  }>();
  for (const identityKey of allIdentityKeys) {
    const newJson = JSON.parse(identityKey.json);
    newJson.id = allConversationsByOldId[newJson.id];
    db.prepare(
      `
      UPDATE identityKeys
      SET id = $newId, json = $newJson
      WHERE id = $oldId
      `
    ).run({
      newId: newJson.id,
      newJson: objectToJSON(newJson),
      oldId: identityKey.id,
    });
  }

  // Recreate triggers
  for (const trigger of triggers) {
    db.exec(trigger.sql);
  }
}

function updateToSchemaVersion21(db: Database): void {
  db.exec(`
    UPDATE conversations
    SET json = json_set(
      json,
      '$.messageCount',
      (SELECT count(*) FROM messages WHERE messages.conversationId = conversations.id)
    );
    UPDATE conversations
    SET json = json_set(
      json,
      '$.sentMessageCount',
      (SELECT count(*) FROM messages WHERE messages.conversationId = conversations.id AND messages.type = 'outgoing')
    );
  `);
}

function updateToSchemaVersion22(db: Database): void {
  db.exec(`
    ALTER TABLE unprocessed
      ADD COLUMN sourceUuid STRING;
  `);
}

function updateToSchemaVersion23(db: Database): void {
  db.exec(`
    -- Remove triggers which keep full-text search up to date
    DROP TRIGGER messages_on_insert;
    DROP TRIGGER messages_on_update;
    DROP TRIGGER messages_on_delete;
  `);
}

function updateToSchemaVersion24(db: Database): void {
  db.exec(`
    ALTER TABLE conversations
    ADD COLUMN profileLastFetchedAt INTEGER;
  `);
}

function updateToSchemaVersion25(db: Database): void {
  db.exec(`
    ALTER TABLE messages
    RENAME TO old_messages
  `);

  const indicesToDrop = [
    'messages_expires_at',
    'messages_receipt',
    'messages_schemaVersion',
    'messages_conversation',
    'messages_duplicate_check',
    'messages_hasAttachments',
    'messages_hasFileAttachments',
    'messages_hasVisualMediaAttachments',
    'messages_without_timer',
    'messages_unread',
    'messages_view_once',
    'messages_sourceUuid',
  ];
  for (const index of indicesToDrop) {
    db.exec(`DROP INDEX IF EXISTS ${index};`);
  }

  db.exec(`
    --
    -- Create a new table with a different primary key
    --

    CREATE TABLE messages(
      rowid INTEGER PRIMARY KEY ASC,
      id STRING UNIQUE,
      json TEXT,
      unread INTEGER,
      expires_at INTEGER,
      sent_at INTEGER,
      schemaVersion INTEGER,
      conversationId STRING,
      received_at INTEGER,
      source STRING,
      sourceDevice STRING,
      hasAttachments INTEGER,
      hasFileAttachments INTEGER,
      hasVisualMediaAttachments INTEGER,
      expireTimer INTEGER,
      expirationStartTimestamp INTEGER,
      type STRING,
      body TEXT,
      messageTimer INTEGER,
      messageTimerStart INTEGER,
      messageTimerExpiresAt INTEGER,
      isErased INTEGER,
      isViewOnce INTEGER,
      sourceUuid TEXT);

    -- Create index in lieu of old PRIMARY KEY
    CREATE INDEX messages_id ON messages (id ASC);

    --
    -- Recreate indices
    --

    CREATE INDEX messages_expires_at ON messages (expires_at);

    CREATE INDEX messages_receipt ON messages (sent_at);

    CREATE INDEX messages_schemaVersion ON messages (schemaVersion);

    CREATE INDEX messages_conversation ON messages
      (conversationId, received_at);

    CREATE INDEX messages_duplicate_check ON messages
      (source, sourceDevice, sent_at);

    CREATE INDEX messages_hasAttachments ON messages
      (conversationId, hasAttachments, received_at);

    CREATE INDEX messages_hasFileAttachments ON messages
      (conversationId, hasFileAttachments, received_at);

    CREATE INDEX messages_hasVisualMediaAttachments ON messages
      (conversationId, hasVisualMediaAttachments, received_at);

    CREATE INDEX messages_without_timer ON messages
      (expireTimer, expires_at, type)
      WHERE expires_at IS NULL AND expireTimer IS NOT NULL;

    CREATE INDEX messages_unread ON messages
      (conversationId, unread) WHERE unread IS NOT NULL;

    CREATE INDEX messages_view_once ON messages
      (isErased) WHERE isViewOnce = 1;

    CREATE INDEX messages_sourceUuid on messages(sourceUuid);

    -- New index for searchMessages
    CREATE INDEX messages_searchOrder on messages(received_at, sent_at);

    --
    -- Re-create messages_fts and add triggers
    --

    DROP TABLE messages_fts;

    CREATE VIRTUAL TABLE messages_fts USING fts5(body);

    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
    BEGIN
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.body);
    END;

    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
    END;

    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.body);
    END;

    --
    -- Copy data over
    --

    INSERT INTO messages
    (
      id, json, unread, expires_at, sent_at, schemaVersion, conversationId,
      received_at, source, sourceDevice, hasAttachments, hasFileAttachments,
      hasVisualMediaAttachments, expireTimer, expirationStartTimestamp, type,
      body, messageTimer, messageTimerStart, messageTimerExpiresAt, isErased,
      isViewOnce, sourceUuid
    )
    SELECT
      id, json, unread, expires_at, sent_at, schemaVersion, conversationId,
      received_at, source, sourceDevice, hasAttachments, hasFileAttachments,
      hasVisualMediaAttachments, expireTimer, expirationStartTimestamp, type,
      body, messageTimer, messageTimerStart, messageTimerExpiresAt, isErased,
      isViewOnce, sourceUuid
    FROM old_messages;

    -- Drop old database
    DROP TABLE old_messages;
  `);
}

function updateToSchemaVersion26(db: Database): void {
  db.exec(`
    DROP TRIGGER messages_on_insert;
    DROP TRIGGER messages_on_update;

    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
    BEGIN
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.body);
    END;

    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN new.body != old.body AND
      (new.isViewOnce IS NULL OR new.isViewOnce != 1)
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.body);
    END;
  `);
}

function updateToSchemaVersion27(db: Database): void {
  db.exec(`
    DELETE FROM messages_fts WHERE rowid IN
      (SELECT rowid FROM messages WHERE body IS NULL);

    DROP TRIGGER messages_on_update;

    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN
      new.body IS NULL OR
      ((old.body IS NULL OR new.body != old.body) AND
       (new.isViewOnce IS NULL OR new.isViewOnce != 1))
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.body);
    END;

    CREATE TRIGGER messages_on_view_once_update AFTER UPDATE ON messages
    WHEN
      new.body IS NOT NULL AND new.isViewOnce = 1
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
    END;
  `);
}

function updateToSchemaVersion28(db: Database): void {
  db.exec(`
    CREATE TABLE jobs(
      id TEXT PRIMARY KEY,
      queueType TEXT STRING NOT NULL,
      timestamp INTEGER NOT NULL,
      data STRING TEXT
    );

    CREATE INDEX jobs_timestamp ON jobs (timestamp);
  `);
}

function updateToSchemaVersion29(db: Database): void {
  db.exec(`
    CREATE TABLE reactions(
      conversationId STRING,
      emoji STRING,
      fromId STRING,
      messageReceivedAt INTEGER,
      targetAuthorUuid STRING,
      targetTimestamp INTEGER,
      unread INTEGER
    );

    CREATE INDEX reactions_unread ON reactions (
      unread,
      conversationId
    );

    CREATE INDEX reaction_identifier ON reactions (
      emoji,
      targetAuthorUuid,
      targetTimestamp
    );
  `);
}

function updateToSchemaVersion30(db: Database): void {
  db.exec(`
    CREATE TABLE senderKeys(
      id TEXT PRIMARY KEY NOT NULL,
      senderId TEXT NOT NULL,
      distributionId TEXT NOT NULL,
      data BLOB NOT NULL,
      lastUpdatedDate NUMBER NOT NULL
    );
  `);
}

function updateToSchemaVersion31(db: Database): void {
  db.exec(`
    DROP INDEX unprocessed_id;
    DROP INDEX unprocessed_timestamp;
    ALTER TABLE unprocessed RENAME TO unprocessed_old;

    CREATE TABLE unprocessed(
      id STRING PRIMARY KEY ASC,
      timestamp INTEGER,
      version INTEGER,
      attempts INTEGER,
      envelope TEXT,
      decrypted TEXT,
      source TEXT,
      sourceDevice TEXT,
      serverTimestamp INTEGER,
      sourceUuid STRING
    );

    CREATE INDEX unprocessed_timestamp ON unprocessed (
      timestamp
    );

    INSERT OR REPLACE INTO unprocessed
      (id, timestamp, version, attempts, envelope, decrypted, source,
       sourceDevice, serverTimestamp, sourceUuid)
    SELECT
      id, timestamp, version, attempts, envelope, decrypted, source,
       sourceDevice, serverTimestamp, sourceUuid
    FROM unprocessed_old;

    DROP TABLE unprocessed_old;
  `);
}

function updateToSchemaVersion32(db: Database): void {
  db.exec(`
    ALTER TABLE messages
    ADD COLUMN serverGuid STRING NULL;

    ALTER TABLE unprocessed
    ADD COLUMN serverGuid STRING NULL;
  `);
}

function updateToSchemaVersion33(db: Database): void {
  db.exec(`
    -- These indexes should exist, but we add "IF EXISTS" for safety.
    DROP INDEX IF EXISTS messages_expires_at;
    DROP INDEX IF EXISTS messages_without_timer;

    ALTER TABLE messages
    ADD COLUMN
    expiresAt INT
    GENERATED ALWAYS
    AS (expirationStartTimestamp + (expireTimer * 1000));

    CREATE INDEX message_expires_at ON messages (
      expiresAt
    );

    CREATE INDEX outgoing_messages_without_expiration_start_timestamp ON messages (
      expireTimer, expirationStartTimestamp, type
    )
    WHERE expireTimer IS NOT NULL AND expirationStartTimestamp IS NULL;
  `);
}

function updateToSchemaVersion34(db: Database): void {
  db.exec(`
    -- This index should exist, but we add "IF EXISTS" for safety.
    DROP INDEX IF EXISTS outgoing_messages_without_expiration_start_timestamp;

    CREATE INDEX messages_unexpectedly_missing_expiration_start_timestamp ON messages (
      expireTimer, expirationStartTimestamp, type
    )
    WHERE expireTimer IS NOT NULL AND expirationStartTimestamp IS NULL;
  `);
}

function updateToSchemaVersion35(db: Database): void {
  db.exec(`
    CREATE INDEX expiring_message_by_conversation_and_received_at
    ON messages
    (
      expirationStartTimestamp,
      expireTimer,
      conversationId,
      received_at
    );
  `);
}

function updateToSchemaVersion36(): void {
  // Reverted
}

function updateToSchemaVersion37(db: Database): void {
  db.exec(`
    -- Create send log primary table

    CREATE TABLE sendLogPayloads(
      id INTEGER PRIMARY KEY ASC,

      timestamp INTEGER NOT NULL,
      contentHint INTEGER NOT NULL,
      proto BLOB NOT NULL
    );

    CREATE INDEX sendLogPayloadsByTimestamp ON sendLogPayloads (timestamp);

    -- Create send log recipients table with foreign key relationship to payloads

    CREATE TABLE sendLogRecipients(
      payloadId INTEGER NOT NULL,

      recipientUuid STRING NOT NULL,
      deviceId INTEGER NOT NULL,

      PRIMARY KEY (payloadId, recipientUuid, deviceId),

      CONSTRAINT sendLogRecipientsForeignKey
        FOREIGN KEY (payloadId)
        REFERENCES sendLogPayloads(id)
        ON DELETE CASCADE
    );

    CREATE INDEX sendLogRecipientsByRecipient
      ON sendLogRecipients (recipientUuid, deviceId);

    -- Create send log messages table with foreign key relationship to payloads

    CREATE TABLE sendLogMessageIds(
      payloadId INTEGER NOT NULL,

      messageId STRING NOT NULL,

      PRIMARY KEY (payloadId, messageId),

      CONSTRAINT sendLogMessageIdsForeignKey
        FOREIGN KEY (payloadId)
        REFERENCES sendLogPayloads(id)
        ON DELETE CASCADE
    );

    CREATE INDEX sendLogMessageIdsByMessage
      ON sendLogMessageIds (messageId);

    -- Recreate messages table delete trigger with send log support

    DROP TRIGGER messages_on_delete;

    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      DELETE FROM sendLogPayloads WHERE id IN (
        SELECT payloadId FROM sendLogMessageIds
        WHERE messageId = old.id
      );
    END;

    --- Add messageId column to reactions table to properly track proto associations

    ALTER TABLE reactions ADD column messageId STRING;
  `);
}

function updateToSchemaVersion38(db: Database): void {
  db.exec(`
    DROP INDEX IF EXISTS messages_duplicate_check;

    ALTER TABLE messages
      RENAME COLUMN sourceDevice TO deprecatedSourceDevice;
    ALTER TABLE messages
      ADD COLUMN sourceDevice INTEGER;

    UPDATE messages
    SET
      sourceDevice = CAST(deprecatedSourceDevice AS INTEGER),
      deprecatedSourceDevice = NULL;

    ALTER TABLE unprocessed
      RENAME COLUMN sourceDevice TO deprecatedSourceDevice;
    ALTER TABLE unprocessed
      ADD COLUMN sourceDevice INTEGER;

    UPDATE unprocessed
    SET
      sourceDevice = CAST(deprecatedSourceDevice AS INTEGER),
      deprecatedSourceDevice = NULL;
  `);
}

function updateToSchemaVersion39(db: Database): void {
  db.exec('ALTER TABLE messages RENAME COLUMN unread TO readStatus;');
}

function updateToSchemaVersion40(db: Database): void {
  db.exec(
    `
    CREATE TABLE groupCallRings(
      ringId INTEGER PRIMARY KEY,
      isActive INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );
    `
  );
}

export type SchemaUpdateType = Readonly<{
  version: number;
  update: (
    db: WritableDB,
    logger: LoggerType,
    startingVersion: number
  ) => void | 'vacuum';
}>;

export const SCHEMA_VERSIONS: ReadonlyArray<SchemaUpdateType> = [
  { version: 1, update: updateToSchemaVersion1 },
  { version: 2, update: updateToSchemaVersion2 },
  { version: 3, update: updateToSchemaVersion3 },
  { version: 4, update: updateToSchemaVersion4 },
  // version 5 was dropped
  { version: 6, update: updateToSchemaVersion6 },
  { version: 7, update: updateToSchemaVersion7 },
  { version: 8, update: updateToSchemaVersion8 },
  { version: 9, update: updateToSchemaVersion9 },

  { version: 10, update: updateToSchemaVersion10 },
  { version: 11, update: updateToSchemaVersion11 },
  { version: 12, update: updateToSchemaVersion12 },
  { version: 13, update: updateToSchemaVersion13 },
  { version: 14, update: updateToSchemaVersion14 },
  { version: 15, update: updateToSchemaVersion15 },
  { version: 16, update: updateToSchemaVersion16 },
  { version: 17, update: updateToSchemaVersion17 },
  { version: 18, update: updateToSchemaVersion18 },
  { version: 19, update: updateToSchemaVersion19 },

  { version: 20, update: updateToSchemaVersion20 },
  { version: 21, update: updateToSchemaVersion21 },
  { version: 22, update: updateToSchemaVersion22 },
  { version: 23, update: updateToSchemaVersion23 },
  { version: 24, update: updateToSchemaVersion24 },
  { version: 25, update: updateToSchemaVersion25 },
  { version: 26, update: updateToSchemaVersion26 },
  { version: 27, update: updateToSchemaVersion27 },
  { version: 28, update: updateToSchemaVersion28 },
  { version: 29, update: updateToSchemaVersion29 },

  { version: 30, update: updateToSchemaVersion30 },
  { version: 31, update: updateToSchemaVersion31 },
  { version: 32, update: updateToSchemaVersion32 },
  { version: 33, update: updateToSchemaVersion33 },
  { version: 34, update: updateToSchemaVersion34 },
  { version: 35, update: updateToSchemaVersion35 },
  { version: 36, update: updateToSchemaVersion36 },
  { version: 37, update: updateToSchemaVersion37 },
  { version: 38, update: updateToSchemaVersion38 },
  { version: 39, update: updateToSchemaVersion39 },

  { version: 40, update: updateToSchemaVersion40 },
  { version: 41, update: updateToSchemaVersion41 },
  { version: 42, update: updateToSchemaVersion42 },
  { version: 43, update: updateToSchemaVersion43 },
  { version: 44, update: updateToSchemaVersion44 },
  { version: 45, update: updateToSchemaVersion45 },
  { version: 46, update: updateToSchemaVersion46 },
  { version: 47, update: updateToSchemaVersion47 },
  { version: 48, update: updateToSchemaVersion48 },
  { version: 49, update: updateToSchemaVersion49 },

  { version: 50, update: updateToSchemaVersion50 },
  { version: 51, update: updateToSchemaVersion51 },
  { version: 52, update: updateToSchemaVersion52 },
  { version: 53, update: updateToSchemaVersion53 },
  { version: 54, update: updateToSchemaVersion54 },
  { version: 55, update: updateToSchemaVersion55 },
  { version: 56, update: updateToSchemaVersion56 },
  { version: 57, update: updateToSchemaVersion57 },
  { version: 58, update: updateToSchemaVersion58 },
  { version: 59, update: updateToSchemaVersion59 },

  { version: 60, update: updateToSchemaVersion60 },
  { version: 61, update: updateToSchemaVersion61 },
  { version: 62, update: updateToSchemaVersion62 },
  { version: 63, update: updateToSchemaVersion63 },
  { version: 64, update: updateToSchemaVersion64 },
  { version: 65, update: updateToSchemaVersion65 },
  { version: 66, update: updateToSchemaVersion66 },
  { version: 67, update: updateToSchemaVersion67 },
  { version: 68, update: updateToSchemaVersion68 },
  { version: 69, update: updateToSchemaVersion69 },

  { version: 70, update: updateToSchemaVersion70 },
  { version: 71, update: updateToSchemaVersion71 },
  { version: 72, update: updateToSchemaVersion72 },
  { version: 73, update: updateToSchemaVersion73 },
  { version: 74, update: updateToSchemaVersion74 },
  { version: 75, update: updateToSchemaVersion75 },
  { version: 76, update: updateToSchemaVersion76 },
  { version: 77, update: updateToSchemaVersion77 },
  { version: 78, update: updateToSchemaVersion78 },
  { version: 79, update: updateToSchemaVersion79 },

  { version: 80, update: updateToSchemaVersion80 },
  { version: 81, update: updateToSchemaVersion81 },
  { version: 82, update: updateToSchemaVersion82 },
  { version: 83, update: updateToSchemaVersion83 },
  { version: 84, update: updateToSchemaVersion84 },
  { version: 85, update: updateToSchemaVersion85 },
  { version: 86, update: updateToSchemaVersion86 },
  { version: 87, update: updateToSchemaVersion87 },
  { version: 88, update: updateToSchemaVersion88 },
  { version: 89, update: updateToSchemaVersion89 },

  { version: 90, update: updateToSchemaVersion90 },
  { version: 91, update: updateToSchemaVersion91 },
  // From here forward, all migrations should be multiples of 10
  { version: 920, update: updateToSchemaVersion920 },
  { version: 930, update: updateToSchemaVersion930 },
  { version: 940, update: updateToSchemaVersion940 },
  { version: 950, update: updateToSchemaVersion950 },
  { version: 960, update: updateToSchemaVersion960 },
  { version: 970, update: updateToSchemaVersion970 },
  { version: 980, update: updateToSchemaVersion980 },
  { version: 990, update: updateToSchemaVersion990 },

  { version: 1000, update: updateToSchemaVersion1000 },
  { version: 1010, update: updateToSchemaVersion1010 },
  { version: 1020, update: updateToSchemaVersion1020 },
  { version: 1030, update: updateToSchemaVersion1030 },
  { version: 1040, update: updateToSchemaVersion1040 },
  { version: 1050, update: updateToSchemaVersion1050 },
  { version: 1060, update: updateToSchemaVersion1060 },
  { version: 1070, update: updateToSchemaVersion1070 },
  { version: 1080, update: updateToSchemaVersion1080 },
  { version: 1090, update: updateToSchemaVersion1090 },

  { version: 1100, update: updateToSchemaVersion1100 },
  { version: 1110, update: updateToSchemaVersion1110 },
  { version: 1120, update: updateToSchemaVersion1120 },
  { version: 1130, update: updateToSchemaVersion1130 },
  { version: 1140, update: updateToSchemaVersion1140 },
  { version: 1150, update: updateToSchemaVersion1150 },
  { version: 1160, update: updateToSchemaVersion1160 },
  { version: 1170, update: updateToSchemaVersion1170 },
  { version: 1180, update: updateToSchemaVersion1180 },
  { version: 1190, update: updateToSchemaVersion1190 },

  { version: 1200, update: updateToSchemaVersion1200 },
  { version: 1210, update: updateToSchemaVersion1210 },
  { version: 1220, update: updateToSchemaVersion1220 },
  { version: 1230, update: updateToSchemaVersion1230 },
  { version: 1240, update: updateToSchemaVersion1240 },
  { version: 1250, update: updateToSchemaVersion1250 },
  { version: 1260, update: updateToSchemaVersion1260 },
  { version: 1270, update: updateToSchemaVersion1270 },
  { version: 1280, update: updateToSchemaVersion1280 },
  { version: 1290, update: updateToSchemaVersion1290 },

  { version: 1300, update: updateToSchemaVersion1300 },
  { version: 1310, update: updateToSchemaVersion1310 },
  { version: 1320, update: updateToSchemaVersion1320 },
  { version: 1330, update: updateToSchemaVersion1330 },
  { version: 1340, update: updateToSchemaVersion1340 },
  { version: 1350, update: updateToSchemaVersion1350 },
  { version: 1360, update: updateToSchemaVersion1360 },
  { version: 1370, update: updateToSchemaVersion1370 },
  { version: 1380, update: updateToSchemaVersion1380 },
  { version: 1390, update: updateToSchemaVersion1390 },

  { version: 1400, update: updateToSchemaVersion1400 },
  { version: 1410, update: updateToSchemaVersion1410 },
  { version: 1420, update: updateToSchemaVersion1420 },
  { version: 1430, update: updateToSchemaVersion1430 },
  { version: 1440, update: updateToSchemaVersion1440 },
  { version: 1450, update: updateToSchemaVersion1450 },
  { version: 1460, update: updateToSchemaVersion1460 },
  { version: 1470, update: updateToSchemaVersion1470 },
  { version: 1480, update: updateToSchemaVersion1480 },
  { version: 1490, update: updateToSchemaVersion1490 },
];

export class DBVersionFromFutureError extends Error {
  override name = 'DBVersionFromFutureError';
}

export function enableFTS5SecureDelete(db: Database, logger: LoggerType): void {
  const isEnabled =
    db
      .prepare(
        `
      SELECT v FROM messages_fts_config WHERE k is 'secure-delete';
    `,
        {
          pluck: true,
        }
      )
      .get() === 1;

  if (!isEnabled) {
    logger.info('enableFTS5SecureDelete: enabling');
    db.exec(`
      -- Enable secure-delete
      INSERT INTO messages_fts
      (messages_fts, rank)
      VALUES
      ('secure-delete', 1);
    `);
  }
}

export function updateSchema(db: WritableDB, logger: LoggerType): void {
  const sqliteVersion = getSQLiteVersion(db);
  const sqlcipherVersion = getSQLCipherVersion(db);
  const startingVersion = getUserVersion(db);
  const schemaVersion = getSchemaVersion(db);

  const MAX_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1].version;

  for (let i = 1; i < SCHEMA_VERSIONS.length; i += 1) {
    const prev = SCHEMA_VERSIONS[i - 1].version;
    const next = SCHEMA_VERSIONS[i].version;
    if (prev >= next) {
      throw new Error(
        `Migration versions are not monotonic: ${prev} >= ${next}`
      );
    }
  }

  logger.info(
    'updateSchema:\n',
    ` Current user_version: ${startingVersion};\n`,
    ` Most recent db schema: ${MAX_VERSION};\n`,
    ` SQLite version: ${sqliteVersion};\n`,
    ` SQLCipher version: ${sqlcipherVersion};\n`,
    ` (deprecated) schema_version: ${schemaVersion};\n`
  );

  if (startingVersion > MAX_VERSION) {
    throw new DBVersionFromFutureError(
      `SQL: User version is ${startingVersion} but the expected maximum version ` +
        `is ${MAX_VERSION}.`
    );
  }

  // Try to run as many migrations as possible in a single transaction, but if
  // one requires vacuum - commit, vacuum, and continue from where we stopped
  let i = 0;
  while (i < SCHEMA_VERSIONS.length) {
    // eslint-disable-next-line no-loop-func
    const needsVacuum = db.transaction(() => {
      for (; i < SCHEMA_VERSIONS.length; i += 1) {
        const { version, update } = SCHEMA_VERSIONS[i];
        if (version <= startingVersion) {
          continue;
        }

        const schemaLogger = logger.child(`updateSchema(${version})`);
        const result = update(db, schemaLogger, startingVersion);
        if (result === 'vacuum') {
          schemaLogger.info('success, needs vacuum');

          db.pragma(`user_version = ${version}`);
          i += 1;
          return true;
        }

        schemaLogger.info('success');
      }

      db.pragma(`user_version = ${MAX_VERSION}`);
      return false;
    })();

    if (needsVacuum) {
      logger.info('running vacuum');
      db.exec('VACUUM');
      logger.info('done running vacuum');
    }
  }

  DataWriter.ensureMessageInsertTriggersAreEnabled(db);
  enableFTS5SecureDelete(db, logger);

  if (startingVersion !== MAX_VERSION) {
    const start = Date.now();
    db.pragma('optimize');
    const duration = Date.now() - start;
    logger.info(`updateSchema: optimize took ${duration}ms`);
  }
}
