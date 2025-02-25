// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';
import { keyBy } from 'lodash';
import { v4 as generateUuid } from 'uuid';

import type { LoggerType } from '../../types/Logging';
import {
  getSchemaVersion,
  getUserVersion,
  getSQLCipherVersion,
  getSQLiteVersion,
  objectToJSON,
  jsonToObject,
} from '../util';
import type { Query, EmptyQuery } from '../util';
import type { WritableDB } from '../Interface';

import updateToSchemaVersion41 from './41-uuid-keys';
import updateToSchemaVersion42 from './42-stale-reactions';
import updateToSchemaVersion43 from './43-gv2-uuid';
import updateToSchemaVersion44 from './44-badges';
import updateToSchemaVersion45 from './45-stories';
import updateToSchemaVersion46 from './46-optimize-stories';
import updateToSchemaVersion47 from './47-further-optimize';
import updateToSchemaVersion48 from './48-fix-user-initiated-index';
import updateToSchemaVersion49 from './49-fix-preview-index';
import updateToSchemaVersion50 from './50-fix-messages-unread-index';
import updateToSchemaVersion51 from './51-centralize-conversation-jobs';
import updateToSchemaVersion52 from './52-optimize-stories';
import updateToSchemaVersion53 from './53-gv2-banned-members';
import updateToSchemaVersion54 from './54-unprocessed-received-at-counter';
import updateToSchemaVersion55 from './55-report-message-aci';
import updateToSchemaVersion56 from './56-add-unseen-to-message';
import updateToSchemaVersion57 from './57-rm-message-history-unsynced';
import updateToSchemaVersion58 from './58-update-unread';
import updateToSchemaVersion59 from './59-unprocessed-received-at-counter-index';
import updateToSchemaVersion60 from './60-update-expiring-index';
import updateToSchemaVersion61 from './61-distribution-list-storage';
import updateToSchemaVersion62 from './62-add-urgent-to-send-log';
import updateToSchemaVersion63 from './63-add-urgent-to-unprocessed';
import updateToSchemaVersion64 from './64-uuid-column-for-pre-keys';
import updateToSchemaVersion65 from './65-add-storage-id-to-stickers';
import updateToSchemaVersion66 from './66-add-pni-signature-to-sent-protos';
import updateToSchemaVersion67 from './67-add-story-to-unprocessed';
import updateToSchemaVersion68 from './68-drop-deprecated-columns';
import updateToSchemaVersion69 from './69-group-call-ring-cancellations';
import updateToSchemaVersion70 from './70-story-reply-index';
import updateToSchemaVersion71 from './71-merge-notifications';
import updateToSchemaVersion72 from './72-optimize-call-id-message-lookup';
import updateToSchemaVersion73 from './73-remove-phone-number-discovery';
import updateToSchemaVersion74 from './74-optimize-convo-open';
import updateToSchemaVersion75 from './75-noop';
import updateToSchemaVersion76 from './76-optimize-convo-open-2';
import updateToSchemaVersion77 from './77-signal-tokenizer';
import updateToSchemaVersion78 from './78-merge-receipt-jobs';
import updateToSchemaVersion79 from './79-paging-lightbox';
import updateToSchemaVersion80 from './80-edited-messages';
import updateToSchemaVersion81 from './81-contact-removed-notification';
import updateToSchemaVersion82 from './82-edited-messages-read-index';
import updateToSchemaVersion83 from './83-mentions';
import updateToSchemaVersion84 from './84-all-mentions';
import updateToSchemaVersion85 from './85-add-kyber-keys';
import updateToSchemaVersion86 from './86-story-replies-index';
import updateToSchemaVersion87 from './87-cleanup';
import updateToSchemaVersion88 from './88-service-ids';
import updateToSchemaVersion89 from './89-call-history';
import updateToSchemaVersion90 from './90-delete-story-reply-screenshot';
import updateToSchemaVersion91 from './91-clean-keys';
import { updateToSchemaVersion920 } from './920-clean-more-keys';
import { updateToSchemaVersion930 } from './930-fts5-secure-delete';
import { updateToSchemaVersion940 } from './940-fts5-revert';
import { updateToSchemaVersion950 } from './950-fts5-secure-delete';
import { updateToSchemaVersion960 } from './960-untag-pni';
import { updateToSchemaVersion970 } from './970-fts5-optimize';
import { updateToSchemaVersion980 } from './980-reaction-timestamp';
import { updateToSchemaVersion990 } from './990-phone-number-sharing';
import { updateToSchemaVersion1000 } from './1000-mark-unread-call-history-messages-as-unseen';
import { updateToSchemaVersion1010 } from './1010-call-links-table';
import { updateToSchemaVersion1020 } from './1020-self-merges';
import { updateToSchemaVersion1030 } from './1030-unblock-event';
import { updateToSchemaVersion1040 } from './1040-undownloaded-backed-up-media';
import { updateToSchemaVersion1050 } from './1050-group-send-endorsements';
import { updateToSchemaVersion1060 } from './1060-addressable-messages-and-sync-tasks';
import { updateToSchemaVersion1070 } from './1070-attachment-backup';
import { updateToSchemaVersion1080 } from './1080-nondisappearing-addressable';
import { updateToSchemaVersion1090 } from './1090-message-delete-indexes';
import { updateToSchemaVersion1100 } from './1100-optimize-mark-call-history-read-in-conversation';
import { updateToSchemaVersion1110 } from './1110-sticker-local-key';
import { updateToSchemaVersion1120 } from './1120-messages-foreign-keys-indexes';
import { updateToSchemaVersion1130 } from './1130-isStory-index';
import { updateToSchemaVersion1140 } from './1140-call-links-deleted-column';
import { updateToSchemaVersion1150 } from './1150-expire-timer-version';
import { updateToSchemaVersion1160 } from './1160-optimize-calls-unread-count';
import { updateToSchemaVersion1170 } from './1170-update-call-history-unread-index';
import { updateToSchemaVersion1180 } from './1180-add-attachment-download-source';
import { updateToSchemaVersion1190 } from './1190-call-links-storage';
import { updateToSchemaVersion1200 } from './1200-attachment-download-source-index';
import { updateToSchemaVersion1210 } from './1210-call-history-started-id';
import { updateToSchemaVersion1220 } from './1220-blob-sessions';
import { updateToSchemaVersion1230 } from './1230-call-links-admin-key-index';
import { updateToSchemaVersion1240 } from './1240-defunct-call-links-table';
import { updateToSchemaVersion1250 } from './1250-defunct-call-links-storage';
import { updateToSchemaVersion1260 } from './1260-sync-tasks-rowid';
import { updateToSchemaVersion1270 } from './1270-normalize-messages';
import { updateToSchemaVersion1280 } from './1280-blob-unprocessed';
import { updateToSchemaVersion1290 } from './1290-int-unprocessed-source-device';
import { updateToSchemaVersion1300 } from './1300-sticker-pack-refs';
import { updateToSchemaVersion1310 } from './1310-muted-fixup';
import { updateToSchemaVersion1320 } from './1320-unprocessed-received-at-date';
import {
  updateToSchemaVersion1330,
  version as MAX_VERSION,
} from './1330-sync-tasks-type-index';

import { DataWriter } from '../Server';

function updateToSchemaVersion1(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1) {
    return;
  }

  logger.info('updateToSchemaVersion1: starting...');

  db.transaction(() => {
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

    db.pragma('user_version = 1');
  })();

  logger.info('updateToSchemaVersion1: success!');
}

function updateToSchemaVersion2(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 2) {
    return;
  }

  logger.info('updateToSchemaVersion2: starting...');

  db.transaction(() => {
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
    db.pragma('user_version = 2');
  })();
  logger.info('updateToSchemaVersion2: success!');
}

function updateToSchemaVersion3(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 3) {
    return;
  }

  logger.info('updateToSchemaVersion3: starting...');

  db.transaction(() => {
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

    db.pragma('user_version = 3');
  })();

  logger.info('updateToSchemaVersion3: success!');
}

function updateToSchemaVersion4(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 4) {
    return;
  }

  logger.info('updateToSchemaVersion4: starting...');

  db.transaction(() => {
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

    db.pragma('user_version = 4');
  })();

  logger.info('updateToSchemaVersion4: success!');
}

function updateToSchemaVersion6(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 6) {
    return;
  }
  logger.info('updateToSchemaVersion6: starting...');

  db.transaction(() => {
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

    db.pragma('user_version = 6');
  })();

  logger.info('updateToSchemaVersion6: success!');
}

function updateToSchemaVersion7(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 7) {
    return;
  }
  logger.info('updateToSchemaVersion7: starting...');

  db.transaction(() => {
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

    db.pragma('user_version = 7');
  })();
  logger.info('updateToSchemaVersion7: success!');
}

function updateToSchemaVersion8(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 8) {
    return;
  }
  logger.info('updateToSchemaVersion8: starting...');
  db.transaction(() => {
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

    db.pragma('user_version = 8');
  })();
  logger.info('updateToSchemaVersion8: success!');
}

function updateToSchemaVersion9(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 9) {
    return;
  }
  logger.info('updateToSchemaVersion9: starting...');

  db.transaction(() => {
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

    db.pragma('user_version = 9');
  })();

  logger.info('updateToSchemaVersion9: success!');
}

function updateToSchemaVersion10(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 10) {
    return;
  }
  logger.info('updateToSchemaVersion10: starting...');
  db.transaction(() => {
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

    db.pragma('user_version = 10');
  })();
  logger.info('updateToSchemaVersion10: success!');
}

function updateToSchemaVersion11(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 11) {
    return;
  }
  logger.info('updateToSchemaVersion11: starting...');

  db.transaction(() => {
    db.exec(`
      DROP TABLE groups;
    `);

    db.pragma('user_version = 11');
  })();
  logger.info('updateToSchemaVersion11: success!');
}

function updateToSchemaVersion12(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 12) {
    return;
  }

  logger.info('updateToSchemaVersion12: starting...');
  db.transaction(() => {
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

    db.pragma('user_version = 12');
  })();
  logger.info('updateToSchemaVersion12: success!');
}

function updateToSchemaVersion13(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 13) {
    return;
  }

  logger.info('updateToSchemaVersion13: starting...');
  db.transaction(() => {
    db.exec(`
      ALTER TABLE sticker_packs ADD COLUMN attemptedStatus STRING;
    `);

    db.pragma('user_version = 13');
  })();
  logger.info('updateToSchemaVersion13: success!');
}

function updateToSchemaVersion14(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 14) {
    return;
  }

  logger.info('updateToSchemaVersion14: starting...');
  db.transaction(() => {
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

    db.pragma('user_version = 14');
  })();

  logger.info('updateToSchemaVersion14: success!');
}

function updateToSchemaVersion15(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 15) {
    return;
  }

  logger.info('updateToSchemaVersion15: starting...');
  db.transaction(() => {
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

    db.pragma('user_version = 15');
  })();
  logger.info('updateToSchemaVersion15: success!');
}

function updateToSchemaVersion16(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 16) {
    return;
  }

  logger.info('updateToSchemaVersion16: starting...');
  db.transaction(() => {
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

    db.pragma('user_version = 16');
  })();
  logger.info('updateToSchemaVersion16: success!');
}

function updateToSchemaVersion17(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 17) {
    return;
  }

  logger.info('updateToSchemaVersion17: starting...');
  db.transaction(() => {
    try {
      db.exec(`
        ALTER TABLE messages
        ADD COLUMN isViewOnce INTEGER;

        DROP INDEX messages_message_timer;
      `);
    } catch (error) {
      logger.info(
        'updateToSchemaVersion17: Message table already had isViewOnce column'
      );
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

    db.pragma('user_version = 17');
  })();
  logger.info('updateToSchemaVersion17: success!');
}

function updateToSchemaVersion18(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 18) {
    return;
  }

  logger.info('updateToSchemaVersion18: starting...');
  db.transaction(() => {
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

    db.pragma('user_version = 18');
  })();
  logger.info('updateToSchemaVersion18: success!');
}

function updateToSchemaVersion19(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 19) {
    return;
  }

  logger.info('updateToSchemaVersion19: starting...');
  db.transaction(() => {
    db.exec(`
      ALTER TABLE conversations
      ADD COLUMN profileFamilyName TEXT;
      ALTER TABLE conversations
      ADD COLUMN profileFullName TEXT;

      -- Preload new field with the profileName we already have
      UPDATE conversations SET profileFullName = profileName;
    `);

    db.pragma('user_version = 19');
  })();

  logger.info('updateToSchemaVersion19: success!');
}

function updateToSchemaVersion20(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 20) {
    return;
  }

  logger.info('updateToSchemaVersion20: starting...');
  db.transaction(() => {
    // The triggers on the messages table slow down this migration
    // significantly, so we drop them and recreate them later.
    // Drop triggers
    const triggers = db
      .prepare<EmptyQuery>(
        "SELECT * FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'messages'"
      )
      .all();

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
      .prepare<EmptyQuery>(
        "SELECT * FROM conversations WHERE type = 'group' AND members IS NULL;"
      )
      .all();
    for (const group of maybeInvalidGroups) {
      const json: { id: string; members: Array<unknown> } = JSON.parse(
        group.json
      );
      if (!json.members || !json.members.length) {
        db.prepare<Query>('DELETE FROM conversations WHERE id = $id;').run({
          id: json.id,
        });
        db.prepare<Query>(
          'DELETE FROM messages WHERE conversationId = $id;'
        ).run({ id: json.id });
      }
    }

    // Generate new IDs and alter data
    const allConversations = db
      .prepare<EmptyQuery>('SELECT * FROM conversations;')
      .all();
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

      db.prepare<Query>(
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
      db.prepare<Query>(
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
      .prepare<EmptyQuery>(
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

          db.prepare<Query>(
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
      db.prepare<Query>(
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
    const allSessions = db.prepare<EmptyQuery>('SELECT * FROM sessions;').all();
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
      db.prepare<Query>(
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
    const allIdentityKeys = db
      .prepare<EmptyQuery>('SELECT * FROM identityKeys;')
      .all();
    for (const identityKey of allIdentityKeys) {
      const newJson = JSON.parse(identityKey.json);
      newJson.id = allConversationsByOldId[newJson.id];
      db.prepare<Query>(
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

    db.pragma('user_version = 20');
  })();
  logger.info('updateToSchemaVersion20: success!');
}

function updateToSchemaVersion21(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 21) {
    return;
  }

  db.transaction(() => {
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
    db.pragma('user_version = 21');
  })();
  logger.info('updateToSchemaVersion21: success!');
}

function updateToSchemaVersion22(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 22) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE unprocessed
        ADD COLUMN sourceUuid STRING;
    `);

    db.pragma('user_version = 22');
  })();
  logger.info('updateToSchemaVersion22: success!');
}

function updateToSchemaVersion23(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 23) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      -- Remove triggers which keep full-text search up to date
      DROP TRIGGER messages_on_insert;
      DROP TRIGGER messages_on_update;
      DROP TRIGGER messages_on_delete;
    `);

    db.pragma('user_version = 23');
  })();
  logger.info('updateToSchemaVersion23: success!');
}

function updateToSchemaVersion24(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 24) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE conversations
      ADD COLUMN profileLastFetchedAt INTEGER;
    `);

    db.pragma('user_version = 24');
  })();
  logger.info('updateToSchemaVersion24: success!');
}

function updateToSchemaVersion25(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 25) {
    return;
  }

  db.transaction(() => {
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

    db.pragma('user_version = 25');
  })();
  logger.info('updateToSchemaVersion25: success!');
}

function updateToSchemaVersion26(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 26) {
    return;
  }

  db.transaction(() => {
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

    db.pragma('user_version = 26');
  })();
  logger.info('updateToSchemaVersion26: success!');
}

function updateToSchemaVersion27(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 27) {
    return;
  }

  db.transaction(() => {
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

    db.pragma('user_version = 27');
  })();
  logger.info('updateToSchemaVersion27: success!');
}

function updateToSchemaVersion28(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 28) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      CREATE TABLE jobs(
        id TEXT PRIMARY KEY,
        queueType TEXT STRING NOT NULL,
        timestamp INTEGER NOT NULL,
        data STRING TEXT
      );

      CREATE INDEX jobs_timestamp ON jobs (timestamp);
    `);

    db.pragma('user_version = 28');
  })();
  logger.info('updateToSchemaVersion28: success!');
}

function updateToSchemaVersion29(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 29) {
    return;
  }

  db.transaction(() => {
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

    db.pragma('user_version = 29');
  })();
  logger.info('updateToSchemaVersion29: success!');
}

function updateToSchemaVersion30(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 30) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      CREATE TABLE senderKeys(
        id TEXT PRIMARY KEY NOT NULL,
        senderId TEXT NOT NULL,
        distributionId TEXT NOT NULL,
        data BLOB NOT NULL,
        lastUpdatedDate NUMBER NOT NULL
      );
    `);

    db.pragma('user_version = 30');
  })();
  logger.info('updateToSchemaVersion30: success!');
}

function updateToSchemaVersion31(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 31) {
    return;
  }
  logger.info('updateToSchemaVersion31: starting...');
  db.transaction(() => {
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

    db.pragma('user_version = 31');
  })();
  logger.info('updateToSchemaVersion31: success!');
}

function updateToSchemaVersion32(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 32) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE messages
      ADD COLUMN serverGuid STRING NULL;

      ALTER TABLE unprocessed
      ADD COLUMN serverGuid STRING NULL;
    `);

    db.pragma('user_version = 32');
  })();
  logger.info('updateToSchemaVersion32: success!');
}

function updateToSchemaVersion33(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 33) {
    return;
  }

  db.transaction(() => {
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

    db.pragma('user_version = 33');
  })();
  logger.info('updateToSchemaVersion33: success!');
}

function updateToSchemaVersion34(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 34) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      -- This index should exist, but we add "IF EXISTS" for safety.
      DROP INDEX IF EXISTS outgoing_messages_without_expiration_start_timestamp;

      CREATE INDEX messages_unexpectedly_missing_expiration_start_timestamp ON messages (
        expireTimer, expirationStartTimestamp, type
      )
      WHERE expireTimer IS NOT NULL AND expirationStartTimestamp IS NULL;
    `);

    db.pragma('user_version = 34');
  })();
  logger.info('updateToSchemaVersion34: success!');
}

function updateToSchemaVersion35(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 35) {
    return;
  }

  db.transaction(() => {
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

    db.pragma('user_version = 35');
  })();
  logger.info('updateToSchemaVersion35: success!');
}

// Reverted
function updateToSchemaVersion36(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 36) {
    return;
  }

  db.pragma('user_version = 36');
  logger.info('updateToSchemaVersion36: success!');
}

function updateToSchemaVersion37(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 37) {
    return;
  }

  db.transaction(() => {
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

    db.pragma('user_version = 37');
  })();
  logger.info('updateToSchemaVersion37: success!');
}

function updateToSchemaVersion38(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 38) {
    return;
  }

  db.transaction(() => {
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

    db.pragma('user_version = 38');
  })();
  logger.info('updateToSchemaVersion38: success!');
}

function updateToSchemaVersion39(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 39) {
    return;
  }

  db.transaction(() => {
    db.exec('ALTER TABLE messages RENAME COLUMN unread TO readStatus;');

    db.pragma('user_version = 39');
  })();
  logger.info('updateToSchemaVersion39: success!');
}

function updateToSchemaVersion40(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 40) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      CREATE TABLE groupCallRings(
        ringId INTEGER PRIMARY KEY,
        isActive INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );
      `
    );

    db.pragma('user_version = 40');
  })();
  logger.info('updateToSchemaVersion40: success!');
}

export const SCHEMA_VERSIONS = [
  updateToSchemaVersion1,
  updateToSchemaVersion2,
  updateToSchemaVersion3,
  updateToSchemaVersion4,
  // version 5 was dropped
  updateToSchemaVersion6,
  updateToSchemaVersion7,
  updateToSchemaVersion8,
  updateToSchemaVersion9,

  updateToSchemaVersion10,
  updateToSchemaVersion11,
  updateToSchemaVersion12,
  updateToSchemaVersion13,
  updateToSchemaVersion14,
  updateToSchemaVersion15,
  updateToSchemaVersion16,
  updateToSchemaVersion17,
  updateToSchemaVersion18,
  updateToSchemaVersion19,

  updateToSchemaVersion20,
  updateToSchemaVersion21,
  updateToSchemaVersion22,
  updateToSchemaVersion23,
  updateToSchemaVersion24,
  updateToSchemaVersion25,
  updateToSchemaVersion26,
  updateToSchemaVersion27,
  updateToSchemaVersion28,
  updateToSchemaVersion29,

  updateToSchemaVersion30,
  updateToSchemaVersion31,
  updateToSchemaVersion32,
  updateToSchemaVersion33,
  updateToSchemaVersion34,
  updateToSchemaVersion35,
  updateToSchemaVersion36,
  updateToSchemaVersion37,
  updateToSchemaVersion38,
  updateToSchemaVersion39,

  updateToSchemaVersion40,
  updateToSchemaVersion41,
  updateToSchemaVersion42,
  updateToSchemaVersion43,
  updateToSchemaVersion44,
  updateToSchemaVersion45,
  updateToSchemaVersion46,
  updateToSchemaVersion47,
  updateToSchemaVersion48,
  updateToSchemaVersion49,

  updateToSchemaVersion50,
  updateToSchemaVersion51,
  updateToSchemaVersion52,
  updateToSchemaVersion53,
  updateToSchemaVersion54,
  updateToSchemaVersion55,
  updateToSchemaVersion56,
  updateToSchemaVersion57,
  updateToSchemaVersion58,
  updateToSchemaVersion59,

  updateToSchemaVersion60,
  updateToSchemaVersion61,
  updateToSchemaVersion62,
  updateToSchemaVersion63,
  updateToSchemaVersion64,
  updateToSchemaVersion65,
  updateToSchemaVersion66,
  updateToSchemaVersion67,
  updateToSchemaVersion68,
  updateToSchemaVersion69,

  updateToSchemaVersion70,
  updateToSchemaVersion71,
  updateToSchemaVersion72,
  updateToSchemaVersion73,
  updateToSchemaVersion74,
  updateToSchemaVersion75,
  updateToSchemaVersion76,
  updateToSchemaVersion77,
  updateToSchemaVersion78,
  updateToSchemaVersion79,

  updateToSchemaVersion80,
  updateToSchemaVersion81,
  updateToSchemaVersion82,
  updateToSchemaVersion83,
  updateToSchemaVersion84,
  updateToSchemaVersion85,
  updateToSchemaVersion86,
  updateToSchemaVersion87,
  updateToSchemaVersion88,
  updateToSchemaVersion89,

  updateToSchemaVersion90,
  updateToSchemaVersion91,
  // From here forward, all migrations should be multiples of 10
  updateToSchemaVersion920,
  updateToSchemaVersion930,
  updateToSchemaVersion940,
  updateToSchemaVersion950,
  updateToSchemaVersion960,
  updateToSchemaVersion970,
  updateToSchemaVersion980,
  updateToSchemaVersion990,

  updateToSchemaVersion1000,
  updateToSchemaVersion1010,
  updateToSchemaVersion1020,
  updateToSchemaVersion1030,
  updateToSchemaVersion1040,
  updateToSchemaVersion1050,
  updateToSchemaVersion1060,
  updateToSchemaVersion1070,
  updateToSchemaVersion1080,
  updateToSchemaVersion1090,

  updateToSchemaVersion1100,
  updateToSchemaVersion1110,
  updateToSchemaVersion1120,
  updateToSchemaVersion1130,
  updateToSchemaVersion1140,
  updateToSchemaVersion1150,
  updateToSchemaVersion1160,
  updateToSchemaVersion1170,
  updateToSchemaVersion1180,
  updateToSchemaVersion1190,

  updateToSchemaVersion1200,
  updateToSchemaVersion1210,
  updateToSchemaVersion1220,
  updateToSchemaVersion1230,
  updateToSchemaVersion1240,
  updateToSchemaVersion1250,
  updateToSchemaVersion1260,
  updateToSchemaVersion1270,
  updateToSchemaVersion1280,
  updateToSchemaVersion1290,

  updateToSchemaVersion1300,
  updateToSchemaVersion1310,
  updateToSchemaVersion1320,
  updateToSchemaVersion1330,
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
        `
      )
      .pluck()
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

  for (let index = 0, max = SCHEMA_VERSIONS.length; index < max; index += 1) {
    const runSchemaUpdate = SCHEMA_VERSIONS[index];

    runSchemaUpdate(startingVersion, db, logger);
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
