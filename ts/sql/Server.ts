// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-nested-ternary */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { join } from 'path';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import SQL, { Database, Statement } from 'better-sqlite3';

import { v4 as generateUUID } from 'uuid';
import {
  Dictionary,
  forEach,
  fromPairs,
  isNil,
  isNumber,
  isString,
  keyBy,
  last,
  map,
  pick,
  omit,
} from 'lodash';

import { assert } from '../util/assert';
import { isNormalNumber } from '../util/isNormalNumber';
import { combineNames } from '../util/combineNames';

import { GroupV2MemberType } from '../model-types.d';

import {
  AttachmentDownloadJobType,
  ConversationMetricsType,
  ConversationType,
  EmojiType,
  IdentityKeyType,
  ItemType,
  MessageType,
  MessageTypeUnhydrated,
  MessageMetricsType,
  PreKeyType,
  SearchResultMessageType,
  ServerInterface,
  SessionType,
  SignedPreKeyType,
  StickerPackStatusType,
  StickerPackType,
  StickerType,
  UnprocessedType,
} from './Interface';

declare global {
  // We want to extend `Function`'s properties, so we need to use an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Function {
    needsSerial?: boolean;
  }
}

type JSONRows = Array<{ readonly json: string }>;
type ConversationRow = Readonly<{
  json: string;
  profileLastFetchedAt: null | number;
}>;
type ConversationRows = Array<ConversationRow>;
type StickerRow = Readonly<{
  id: number;
  packId: string;
  emoji: string | null;
  height: number;
  isCoverOnly: number;
  lastUsed: number;
  path: string;
  width: number;
}>;

type EmptyQuery = [];
type ArrayQuery = Array<Array<null | number | string>>;
type Query = { [key: string]: null | number | string };

// Because we can't force this module to conform to an interface, we narrow our exports
//   to this one default export, which does conform to the interface.
// Note: In Javascript, you need to access the .default property when requiring it
// https://github.com/microsoft/TypeScript/issues/420
const dataInterface: ServerInterface = {
  close,
  removeDB,
  removeIndexedDBFiles,

  createOrUpdateIdentityKey,
  getIdentityKeyById,
  bulkAddIdentityKeys,
  removeIdentityKeyById,
  removeAllIdentityKeys,
  getAllIdentityKeys,

  createOrUpdatePreKey,
  getPreKeyById,
  bulkAddPreKeys,
  removePreKeyById,
  removeAllPreKeys,
  getAllPreKeys,

  createOrUpdateSignedPreKey,
  getSignedPreKeyById,
  getAllSignedPreKeys,
  bulkAddSignedPreKeys,
  removeSignedPreKeyById,
  removeAllSignedPreKeys,

  createOrUpdateItem,
  getItemById,
  getAllItems,
  bulkAddItems,
  removeItemById,
  removeAllItems,

  createOrUpdateSession,
  createOrUpdateSessions,
  getSessionById,
  getSessionsById,
  bulkAddSessions,
  removeSessionById,
  removeSessionsByConversation,
  removeAllSessions,
  getAllSessions,

  getConversationCount,
  saveConversation,
  saveConversations,
  getConversationById,
  updateConversation,
  updateConversations,
  removeConversation,
  eraseStorageServiceStateFromConversations,
  getAllConversations,
  getAllConversationIds,
  getAllPrivateConversations,
  getAllGroupsInvolvingId,

  searchConversations,
  searchMessages,
  searchMessagesInConversation,

  getMessageCount,
  saveMessage,
  saveMessages,
  removeMessage,
  removeMessages,
  getUnreadByConversation,
  getMessageBySender,
  getMessageById,
  _getAllMessages,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getOutgoingWithoutExpiresAt,
  getNextExpiringMessage,
  getNextTapToViewMessageToAgeOut,
  getTapToViewMessagesNeedingErase,
  getOlderMessagesByConversation,
  getNewerMessagesByConversation,
  getMessageMetricsForConversation,
  getLastConversationActivity,
  getLastConversationPreview,
  hasGroupCallHistoryMessage,
  migrateConversationMessages,

  getUnprocessedCount,
  getAllUnprocessed,
  saveUnprocessed,
  updateUnprocessedAttempts,
  updateUnprocessedWithData,
  updateUnprocessedsWithData,
  getUnprocessedById,
  saveUnprocesseds,
  removeUnprocessed,
  removeAllUnprocessed,

  getNextAttachmentDownloadJobs,
  saveAttachmentDownloadJob,
  setAttachmentDownloadJobPending,
  resetAttachmentDownloadPending,
  removeAttachmentDownloadJob,
  removeAllAttachmentDownloadJobs,

  createOrUpdateStickerPack,
  updateStickerPackStatus,
  createOrUpdateSticker,
  updateStickerLastUsed,
  addStickerPackReference,
  deleteStickerPackReference,
  getStickerCount,
  deleteStickerPack,
  getAllStickerPacks,
  getAllStickers,
  getRecentStickers,
  clearAllErrorStickerPackAttempts,

  updateEmojiUsage,
  getRecentEmojis,

  removeAll,
  removeAllConfiguration,

  getMessagesNeedingUpgrade,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,

  // Server-only

  initialize,
  initializeRenderer,

  removeKnownAttachments,
  removeKnownStickers,
  removeKnownDraftAttachments,
};
export default dataInterface;

type DatabaseQueryCache = Map<string, Statement<any[]>>;

const statementCache = new WeakMap<Database, DatabaseQueryCache>();

function prepare(db: Database, query: string): Statement<Query> {
  let dbCache = statementCache.get(db);
  if (!dbCache) {
    dbCache = new Map();
    statementCache.set(db, dbCache);
  }

  let result = dbCache.get(query);
  if (!result) {
    result = db.prepare(query);
    dbCache.set(query, result);
  }

  return result;
}

function objectToJSON(data: any) {
  return JSON.stringify(data);
}
function jsonToObject(json: string): any {
  return JSON.parse(json);
}
function rowToConversation(row: ConversationRow): ConversationType {
  const parsedJson = JSON.parse(row.json);

  let profileLastFetchedAt: undefined | number;
  if (isNormalNumber(row.profileLastFetchedAt)) {
    profileLastFetchedAt = row.profileLastFetchedAt;
  } else {
    assert(
      isNil(row.profileLastFetchedAt),
      'profileLastFetchedAt contained invalid data; defaulting to undefined'
    );
    profileLastFetchedAt = undefined;
  }

  return {
    ...parsedJson,
    profileLastFetchedAt,
  };
}
function rowToSticker(row: StickerRow): StickerType {
  return {
    ...row,
    isCoverOnly: Boolean(row.isCoverOnly),
  };
}

function isRenderer() {
  if (typeof process === 'undefined' || !process) {
    return true;
  }

  return process.type === 'renderer';
}

function getSQLiteVersion(db: Database): string {
  const { sqlite_version } = db
    .prepare<EmptyQuery>('select sqlite_version() AS sqlite_version')
    .get();

  return sqlite_version;
}

function getSchemaVersion(db: Database): number {
  return db.pragma('schema_version', { simple: true });
}

function setUserVersion(db: Database, version: number): void {
  if (!isNumber(version)) {
    throw new Error(`setUserVersion: version ${version} is not a number`);
  }
  db.pragma(`user_version = ${version}`);
}
function keyDatabase(db: Database, key: string): void {
  // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
  db.pragma(`key = "x'${key}'"`);

  // https://sqlite.org/wal.html
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
}
function getUserVersion(db: Database): number {
  return db.pragma('user_version', { simple: true });
}

function getSQLCipherVersion(db: Database): string | undefined {
  return db.pragma('cipher_version', { simple: true });
}

function getSQLCipherIntegrityCheck(db: Database): Array<string> | undefined {
  const rows: Array<{ cipher_integrity_check: string }> = db.pragma(
    'cipher_integrity_check'
  );
  if (rows.length === 0) {
    return undefined;
  }
  return rows.map(row => row.cipher_integrity_check);
}

function getSQLIntegrityCheck(db: Database): string | undefined {
  const checkResult = db.pragma('quick_check', { simple: true });
  if (checkResult !== 'ok') {
    return checkResult;
  }

  return undefined;
}

function migrateSchemaVersion(db: Database): void {
  const userVersion = getUserVersion(db);
  if (userVersion > 0) {
    return;
  }

  const schemaVersion = getSchemaVersion(db);
  const newUserVersion = schemaVersion > 18 ? 16 : schemaVersion;
  console.log(
    'migrateSchemaVersion: Migrating from schema_version ' +
      `${schemaVersion} to user_version ${newUserVersion}`
  );

  setUserVersion(db, newUserVersion);
}

function openAndMigrateDatabase(filePath: string, key: string) {
  let db: Database | undefined;

  // First, we try to open the database without any cipher changes
  try {
    db = new SQL(filePath);
    keyDatabase(db, key);
    migrateSchemaVersion(db);

    return db;
  } catch (error) {
    if (db) {
      db.close();
    }
    console.log('migrateDatabase: Migration without cipher change failed');
  }

  // If that fails, we try to open the database with 3.x compatibility to extract the
  //   user_version (previously stored in schema_version, blown away by cipher_migrate).
  db = new SQL(filePath);
  keyDatabase(db, key);

  // https://www.zetetic.net/blog/2018/11/30/sqlcipher-400-release/#compatability-sqlcipher-4-0-0
  db.pragma('cipher_compatibility = 3');
  migrateSchemaVersion(db);
  db.close();

  // After migrating user_version -> schema_version, we reopen database, because we can't
  //   migrate to the latest ciphers after we've modified the defaults.
  db = new SQL(filePath);
  keyDatabase(db, key);

  db.pragma('cipher_migrate');

  return db;
}

const INVALID_KEY = /[^0-9A-Fa-f]/;
function openAndSetUpSQLCipher(filePath: string, { key }: { key: string }) {
  const match = INVALID_KEY.exec(key);
  if (match) {
    throw new Error(`setupSQLCipher: key '${key}' is not valid`);
  }

  const db = openAndMigrateDatabase(filePath, key);

  // Because foreign key support is not enabled by default!
  db.pragma('foreign_keys = ON');

  return db;
}

function updateToSchemaVersion1(currentVersion: number, db: Database): void {
  if (currentVersion >= 1) {
    return;
  }

  console.log('updateToSchemaVersion1: starting...');

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

  console.log('updateToSchemaVersion1: success!');
}

function updateToSchemaVersion2(currentVersion: number, db: Database): void {
  if (currentVersion >= 2) {
    return;
  }

  console.log('updateToSchemaVersion2: starting...');

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
  console.log('updateToSchemaVersion2: success!');
}

function updateToSchemaVersion3(currentVersion: number, db: Database): void {
  if (currentVersion >= 3) {
    return;
  }

  console.log('updateToSchemaVersion3: starting...');

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

  console.log('updateToSchemaVersion3: success!');
}

function updateToSchemaVersion4(currentVersion: number, db: Database): void {
  if (currentVersion >= 4) {
    return;
  }

  console.log('updateToSchemaVersion4: starting...');

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

  console.log('updateToSchemaVersion4: success!');
}

function updateToSchemaVersion6(currentVersion: number, db: Database): void {
  if (currentVersion >= 6) {
    return;
  }
  console.log('updateToSchemaVersion6: starting...');

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

  console.log('updateToSchemaVersion6: success!');
}

function updateToSchemaVersion7(currentVersion: number, db: Database): void {
  if (currentVersion >= 7) {
    return;
  }
  console.log('updateToSchemaVersion7: starting...');

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
        SELECT "+" || id, number, json FROM sessions_old;
      DROP TABLE sessions_old;
    `);

    db.pragma('user_version = 7');
  })();
  console.log('updateToSchemaVersion7: success!');
}

function updateToSchemaVersion8(currentVersion: number, db: Database): void {
  if (currentVersion >= 8) {
    return;
  }
  console.log('updateToSchemaVersion8: starting...');
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
  console.log('updateToSchemaVersion8: success!');
}

function updateToSchemaVersion9(currentVersion: number, db: Database): void {
  if (currentVersion >= 9) {
    return;
  }
  console.log('updateToSchemaVersion9: starting...');

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

  console.log('updateToSchemaVersion9: success!');
}

function updateToSchemaVersion10(currentVersion: number, db: Database): void {
  if (currentVersion >= 10) {
    return;
  }
  console.log('updateToSchemaVersion10: starting...');
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
  console.log('updateToSchemaVersion10: success!');
}

function updateToSchemaVersion11(currentVersion: number, db: Database): void {
  if (currentVersion >= 11) {
    return;
  }
  console.log('updateToSchemaVersion11: starting...');

  db.transaction(() => {
    db.exec(`
      DROP TABLE groups;
    `);

    db.pragma('user_version = 11');
  })();
  console.log('updateToSchemaVersion11: success!');
}

function updateToSchemaVersion12(currentVersion: number, db: Database): void {
  if (currentVersion >= 12) {
    return;
  }

  console.log('updateToSchemaVersion12: starting...');
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
  console.log('updateToSchemaVersion12: success!');
}

function updateToSchemaVersion13(currentVersion: number, db: Database): void {
  if (currentVersion >= 13) {
    return;
  }

  console.log('updateToSchemaVersion13: starting...');
  db.transaction(() => {
    db.exec(`
      ALTER TABLE sticker_packs ADD COLUMN attemptedStatus STRING;
    `);

    db.pragma('user_version = 13');
  })();
  console.log('updateToSchemaVersion13: success!');
}

function updateToSchemaVersion14(currentVersion: number, db: Database): void {
  if (currentVersion >= 14) {
    return;
  }

  console.log('updateToSchemaVersion14: starting...');
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

  console.log('updateToSchemaVersion14: success!');
}

function updateToSchemaVersion15(currentVersion: number, db: Database): void {
  if (currentVersion >= 15) {
    return;
  }

  console.log('updateToSchemaVersion15: starting...');
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
  console.log('updateToSchemaVersion15: success!');
}

function updateToSchemaVersion16(currentVersion: number, db: Database): void {
  if (currentVersion >= 16) {
    return;
  }

  console.log('updateToSchemaVersion16: starting...');
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
  console.log('updateToSchemaVersion16: success!');
}

function updateToSchemaVersion17(currentVersion: number, db: Database): void {
  if (currentVersion >= 17) {
    return;
  }

  console.log('updateToSchemaVersion17: starting...');
  db.transaction(() => {
    try {
      db.exec(`
        ALTER TABLE messages
        ADD COLUMN isViewOnce INTEGER;

        DROP INDEX messages_message_timer;
      `);
    } catch (error) {
      console.log(
        'updateToSchemaVersion17: Message table already had isViewOnce column'
      );
    }

    try {
      db.exec('DROP INDEX messages_view_once;');
    } catch (error) {
      console.log(
        'updateToSchemaVersion17: Index messages_view_once did not already exist'
      );
    }

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
  console.log('updateToSchemaVersion17: success!');
}

function updateToSchemaVersion18(currentVersion: number, db: Database): void {
  if (currentVersion >= 18) {
    return;
  }

  console.log('updateToSchemaVersion18: starting...');
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
  console.log('updateToSchemaVersion18: success!');
}

function updateToSchemaVersion19(currentVersion: number, db: Database): void {
  if (currentVersion >= 19) {
    return;
  }

  console.log('updateToSchemaVersion19: starting...');
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

  console.log('updateToSchemaVersion19: success!');
}

function updateToSchemaVersion20(currentVersion: number, db: Database): void {
  if (currentVersion >= 20) {
    return;
  }

  console.log('updateToSchemaVersion20: starting...');
  db.transaction(() => {
    // The triggers on the messages table slow down this migration
    // significantly, so we drop them and recreate them later.
    // Drop triggers
    const triggers = db
      .prepare<EmptyQuery>(
        'SELECT * FROM sqlite_master WHERE type = "trigger" AND tbl_name = "messages"'
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
      const json: { id: string; members: Array<any> } = JSON.parse(group.json);
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
      const newId = generateUUID();
      allConversationsByOldId[oldId].id = newId;
      const patchObj: any = { id: newId };
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
          const id = generateUUID();
          saveConversation({
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
          });

          newMembers.push(id);
        }
      }
      const json = { ...jsonToObject(groupRow.json), members: newMembers };
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
  console.log('updateToSchemaVersion20: success!');
}

function updateToSchemaVersion21(currentVersion: number, db: Database): void {
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
  console.log('updateToSchemaVersion21: success!');
}

function updateToSchemaVersion22(currentVersion: number, db: Database): void {
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
  console.log('updateToSchemaVersion22: success!');
}

function updateToSchemaVersion23(currentVersion: number, db: Database): void {
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
  console.log('updateToSchemaVersion23: success!');
}

function updateToSchemaVersion24(currentVersion: number, db: Database): void {
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
  console.log('updateToSchemaVersion24: success!');
}

async function updateToSchemaVersion25(currentVersion: number, db: Database) {
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
}

async function updateToSchemaVersion26(currentVersion: number, db: Database) {
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
}

async function updateToSchemaVersion27(currentVersion: number, db: Database) {
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
}

const SCHEMA_VERSIONS = [
  updateToSchemaVersion1,
  updateToSchemaVersion2,
  updateToSchemaVersion3,
  updateToSchemaVersion4,
  (_v: number, _i: Database) => null, // version 5 was dropped
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
];

function updateSchema(db: Database): void {
  const sqliteVersion = getSQLiteVersion(db);
  const sqlcipherVersion = getSQLCipherVersion(db);
  const userVersion = getUserVersion(db);
  const maxUserVersion = SCHEMA_VERSIONS.length;
  const schemaVersion = getSchemaVersion(db);

  console.log(
    'updateSchema:\n',
    ` Current user_version: ${userVersion};\n`,
    ` Most recent db schema: ${maxUserVersion};\n`,
    ` SQLite version: ${sqliteVersion};\n`,
    ` SQLCipher version: ${sqlcipherVersion};\n`,
    ` (deprecated) schema_version: ${schemaVersion};\n`
  );

  if (userVersion > maxUserVersion) {
    throw new Error(
      `SQL: User version is ${userVersion} but the expected maximum version is ${maxUserVersion}. Did you try to start an old version of Signal?`
    );
  }

  for (let index = 0; index < maxUserVersion; index += 1) {
    const runSchemaUpdate = SCHEMA_VERSIONS[index];

    runSchemaUpdate(userVersion, db);
  }
}

let globalInstance: Database | undefined;
let globalInstanceRenderer: Database | undefined;
let databaseFilePath: string | undefined;
let indexedDBPath: string | undefined;

async function initialize({
  configDir,
  key,
}: {
  configDir: string;
  key: string;
}) {
  if (globalInstance) {
    throw new Error('Cannot initialize more than once!');
  }

  if (!isString(configDir)) {
    throw new Error('initialize: configDir is required!');
  }
  if (!isString(key)) {
    throw new Error('initialize: key is required!');
  }

  indexedDBPath = join(configDir, 'IndexedDB');

  const dbDir = join(configDir, 'sql');
  mkdirp.sync(dbDir);

  databaseFilePath = join(dbDir, 'db.sqlite');

  let db: Database | undefined;

  try {
    db = openAndSetUpSQLCipher(databaseFilePath, { key });

    // For profiling use:
    // db.pragma('cipher_profile=\'sqlcipher.log\'');

    updateSchema(db);

    // test database

    const cipherIntegrityResult = getSQLCipherIntegrityCheck(db);
    if (cipherIntegrityResult) {
      console.log(
        'Database cipher integrity check failed:',
        cipherIntegrityResult
      );
      throw new Error(
        `Cipher integrity check failed: ${cipherIntegrityResult}`
      );
    }
    const integrityResult = getSQLIntegrityCheck(db);
    if (integrityResult) {
      console.log('Database integrity check failed:', integrityResult);
      throw new Error(`Integrity check failed: ${integrityResult}`);
    }

    // At this point we can allow general access to the database
    globalInstance = db;

    // test database
    await getMessageCount();
  } catch (error) {
    console.log('Database startup error:', error.stack);
    if (db) {
      db.close();
    }
    throw error;
  }
}

async function initializeRenderer({
  configDir,
  key,
}: {
  configDir: string;
  key: string;
}) {
  if (!isRenderer()) {
    throw new Error('Cannot call from main process.');
  }
  if (globalInstanceRenderer) {
    throw new Error('Cannot initialize more than once!');
  }
  if (!isString(configDir)) {
    throw new Error('initialize: configDir is required!');
  }
  if (!isString(key)) {
    throw new Error('initialize: key is required!');
  }

  if (!indexedDBPath) {
    indexedDBPath = join(configDir, 'IndexedDB');
  }

  const dbDir = join(configDir, 'sql');

  if (!databaseFilePath) {
    databaseFilePath = join(dbDir, 'db.sqlite');
  }

  let promisified: Database | undefined;

  try {
    promisified = openAndSetUpSQLCipher(databaseFilePath, { key });

    // At this point we can allow general access to the database
    globalInstanceRenderer = promisified;

    // test database
    await getMessageCount();
  } catch (error) {
    window.log.error('Database startup error:', error.stack);
    throw error;
  }
}

async function close(): Promise<void> {
  if (!globalInstance) {
    return;
  }

  const dbRef = globalInstance;
  globalInstance = undefined;

  // SQLLite documentation suggests that we run `PRAGMA optimize` right before
  // closing the database connection.
  dbRef.pragma('optimize');

  dbRef.close();
}

async function removeDB(): Promise<void> {
  if (globalInstance) {
    throw new Error('removeDB: Cannot erase database when it is open!');
  }
  if (!databaseFilePath) {
    throw new Error(
      'removeDB: Cannot erase database without a databaseFilePath!'
    );
  }

  rimraf.sync(databaseFilePath);
  rimraf.sync(`${databaseFilePath}-shm`);
  rimraf.sync(`${databaseFilePath}-wal`);
}

async function removeIndexedDBFiles(): Promise<void> {
  if (!indexedDBPath) {
    throw new Error(
      'removeIndexedDBFiles: Need to initialize and set indexedDBPath first!'
    );
  }

  const pattern = join(indexedDBPath, '*.leveldb');
  rimraf.sync(pattern);
  indexedDBPath = undefined;
}

function getInstance(): Database {
  if (isRenderer()) {
    if (!globalInstanceRenderer) {
      throw new Error('getInstance: globalInstanceRenderer not set!');
    }
    return globalInstanceRenderer;
  }

  if (!globalInstance) {
    throw new Error('getInstance: globalInstance not set!');
  }

  return globalInstance;
}

const IDENTITY_KEYS_TABLE = 'identityKeys';
function createOrUpdateIdentityKey(data: IdentityKeyType): Promise<void> {
  return createOrUpdate(IDENTITY_KEYS_TABLE, data);
}
function getIdentityKeyById(id: string): Promise<IdentityKeyType | undefined> {
  return getById(IDENTITY_KEYS_TABLE, id);
}
function bulkAddIdentityKeys(array: Array<IdentityKeyType>): Promise<void> {
  return bulkAdd(IDENTITY_KEYS_TABLE, array);
}
function removeIdentityKeyById(id: string): Promise<void> {
  return removeById(IDENTITY_KEYS_TABLE, id);
}
function removeAllIdentityKeys(): Promise<void> {
  return removeAllFromTable(IDENTITY_KEYS_TABLE);
}
function getAllIdentityKeys(): Promise<Array<IdentityKeyType>> {
  return getAllFromTable(IDENTITY_KEYS_TABLE);
}

const PRE_KEYS_TABLE = 'preKeys';
function createOrUpdatePreKey(data: PreKeyType): Promise<void> {
  return createOrUpdate(PRE_KEYS_TABLE, data);
}
function getPreKeyById(id: number): Promise<PreKeyType | undefined> {
  return getById(PRE_KEYS_TABLE, id);
}
function bulkAddPreKeys(array: Array<PreKeyType>): Promise<void> {
  return bulkAdd(PRE_KEYS_TABLE, array);
}
function removePreKeyById(id: number): Promise<void> {
  return removeById(PRE_KEYS_TABLE, id);
}
function removeAllPreKeys(): Promise<void> {
  return removeAllFromTable(PRE_KEYS_TABLE);
}
function getAllPreKeys(): Promise<Array<PreKeyType>> {
  return getAllFromTable(PRE_KEYS_TABLE);
}

const SIGNED_PRE_KEYS_TABLE = 'signedPreKeys';
function createOrUpdateSignedPreKey(data: SignedPreKeyType): Promise<void> {
  return createOrUpdate(SIGNED_PRE_KEYS_TABLE, data);
}
function getSignedPreKeyById(
  id: number
): Promise<SignedPreKeyType | undefined> {
  return getById(SIGNED_PRE_KEYS_TABLE, id);
}
function bulkAddSignedPreKeys(array: Array<SignedPreKeyType>): Promise<void> {
  return bulkAdd(SIGNED_PRE_KEYS_TABLE, array);
}
function removeSignedPreKeyById(id: number): Promise<void> {
  return removeById(SIGNED_PRE_KEYS_TABLE, id);
}
function removeAllSignedPreKeys(): Promise<void> {
  return removeAllFromTable(SIGNED_PRE_KEYS_TABLE);
}
async function getAllSignedPreKeys(): Promise<Array<SignedPreKeyType>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<EmptyQuery>(
      `
      SELECT json
      FROM signedPreKeys
      ORDER BY id ASC;
      `
    )
    .all();

  return rows.map(row => jsonToObject(row.json));
}

const ITEMS_TABLE = 'items';
function createOrUpdateItem(data: ItemType): Promise<void> {
  return createOrUpdate(ITEMS_TABLE, data);
}
function getItemById(id: string): Promise<ItemType> {
  return getById(ITEMS_TABLE, id);
}
async function getAllItems(): Promise<Array<ItemType>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<EmptyQuery>('SELECT json FROM items ORDER BY id ASC;')
    .all();

  return rows.map(row => jsonToObject(row.json));
}
function bulkAddItems(array: Array<ItemType>): Promise<void> {
  return bulkAdd(ITEMS_TABLE, array);
}
function removeItemById(id: string): Promise<void> {
  return removeById(ITEMS_TABLE, id);
}
function removeAllItems(): Promise<void> {
  return removeAllFromTable(ITEMS_TABLE);
}

const SESSIONS_TABLE = 'sessions';
async function createOrUpdateSession(data: SessionType): Promise<void> {
  const db = getInstance();
  const { id, conversationId } = data;
  if (!id) {
    throw new Error(
      'createOrUpdateSession: Provided data did not have a truthy id'
    );
  }
  if (!conversationId) {
    throw new Error(
      'createOrUpdateSession: Provided data did not have a truthy conversationId'
    );
  }

  prepare(
    db,
    `
    INSERT OR REPLACE INTO sessions (
      id,
      conversationId,
      json
    ) values (
      $id,
      $conversationId,
      $json
    )
    `
  ).run({
    id,
    conversationId,
    json: objectToJSON(data),
  });
}
async function createOrUpdateSessions(
  array: Array<SessionType>
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const item of array) {
      createOrUpdateSession(item);
    }
  })();
}

async function getSessionById(id: string): Promise<SessionType | undefined> {
  return getById(SESSIONS_TABLE, id);
}
async function getSessionsById(
  conversationId: string
): Promise<Array<SessionType>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json
      FROM sessions
      WHERE conversationId = $conversationId;
      `
    )
    .all({
      conversationId,
    });

  return rows.map(row => jsonToObject(row.json));
}
function bulkAddSessions(array: Array<SessionType>): Promise<void> {
  return bulkAdd(SESSIONS_TABLE, array);
}
function removeSessionById(id: string): Promise<void> {
  return removeById(SESSIONS_TABLE, id);
}
async function removeSessionsByConversation(
  conversationId: string
): Promise<void> {
  const db = getInstance();
  db.prepare<Query>(
    `
    DELETE FROM sessions
    WHERE conversationId = $conversationId;
    `
  ).run({
    conversationId,
  });
}
function removeAllSessions(): Promise<void> {
  return removeAllFromTable(SESSIONS_TABLE);
}
function getAllSessions(): Promise<Array<SessionType>> {
  return getAllFromTable(SESSIONS_TABLE);
}

async function createOrUpdate(
  table: string,
  data: Record<string, unknown> & { id: string | number }
): Promise<void> {
  const db = getInstance();
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdate: Provided data did not have a truthy id');
  }

  db.prepare<Query>(
    `
    INSERT OR REPLACE INTO ${table} (
      id,
      json
    ) values (
      $id,
      $json
    )
    `
  ).run({
    id,
    json: objectToJSON(data),
  });
}

async function bulkAdd(
  table: string,
  array: Array<Record<string, unknown> & { id: string | number }>
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const data of array) {
      createOrUpdate(table, data);
    }
  })();
}

async function getById<T>(
  table: string,
  id: string | number
): Promise<T | undefined> {
  const db = getInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT *
      FROM ${table}
      WHERE id = $id;
      `
    )
    .get({
      id,
    });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}

async function removeById(
  table: string,
  id: string | number | Array<string | number>
): Promise<void> {
  const db = getInstance();
  if (!Array.isArray(id)) {
    db.prepare<Query>(
      `
      DELETE FROM ${table}
      WHERE id = $id;
      `
    ).run({ id });
    return;
  }

  if (!id.length) {
    throw new Error('removeById: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  db.prepare<ArrayQuery>(
    `
    DELETE FROM ${table}
    WHERE id IN ( ${id.map(() => '?').join(', ')} );
    `
  ).run(id);
}

async function removeAllFromTable(table: string): Promise<void> {
  const db = getInstance();
  db.prepare<EmptyQuery>(`DELETE FROM ${table};`).run();
}

async function getAllFromTable<T>(table: string): Promise<Array<T>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<EmptyQuery>(`SELECT json FROM ${table};`)
    .all();

  return rows.map(row => jsonToObject(row.json));
}

// Conversations

async function getConversationCount(): Promise<number> {
  const db = getInstance();
  const row = db
    .prepare<EmptyQuery>('SELECT count(*) from conversations;')
    .get();

  if (!row) {
    throw new Error(
      'getConversationCount: Unable to get count of conversations'
    );
  }

  return row['count(*)'];
}

async function saveConversation(
  data: ConversationType,
  db = getInstance()
): Promise<void> {
  const {
    active_at,
    e164,
    groupId,
    id,
    members,
    membersV2,
    name,
    profileFamilyName,
    profileName,
    profileLastFetchedAt,
    type,
    uuid,
  } = data;

  // prettier-ignore
  const membersList = membersV2
    ? membersV2.map((item: GroupV2MemberType) => item.conversationId).join(' ')
    : members
      ? members.join(' ')
      : null;

  db.prepare<Query>(
    `
    INSERT INTO conversations (
      id,
      json,

      e164,
      uuid,
      groupId,

      active_at,
      type,
      members,
      name,
      profileName,
      profileFamilyName,
      profileFullName,
      profileLastFetchedAt
    ) values (
      $id,
      $json,

      $e164,
      $uuid,
      $groupId,

      $active_at,
      $type,
      $members,
      $name,
      $profileName,
      $profileFamilyName,
      $profileFullName,
      $profileLastFetchedAt
    );
    `
  ).run({
    id,
    json: objectToJSON(
      omit(data, ['profileLastFetchedAt', 'unblurredAvatarPath'])
    ),

    e164: e164 || null,
    uuid: uuid || null,
    groupId: groupId || null,

    active_at: active_at || null,
    type,
    members: membersList,
    name: name || null,
    profileName: profileName || null,
    profileFamilyName: profileFamilyName || null,
    profileFullName: combineNames(profileName, profileFamilyName) || null,
    profileLastFetchedAt: profileLastFetchedAt || null,
  });
}

async function saveConversations(
  arrayOfConversations: Array<ConversationType>
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const conversation of arrayOfConversations) {
      saveConversation(conversation);
    }
  })();
}

async function updateConversation(data: ConversationType): Promise<void> {
  const db = getInstance();
  const {
    id,
    active_at,
    type,
    members,
    membersV2,
    name,
    profileName,
    profileFamilyName,
    profileLastFetchedAt,
    e164,
    uuid,
  } = data;

  // prettier-ignore
  const membersList = membersV2
    ? membersV2.map((item: GroupV2MemberType) => item.conversationId).join(' ')
    : members
      ? members.join(' ')
      : null;

  prepare(
    db,
    `
    UPDATE conversations SET
      json = $json,

      e164 = $e164,
      uuid = $uuid,

      active_at = $active_at,
      type = $type,
      members = $members,
      name = $name,
      profileName = $profileName,
      profileFamilyName = $profileFamilyName,
      profileFullName = $profileFullName,
      profileLastFetchedAt = $profileLastFetchedAt
    WHERE id = $id;
    `
  ).run({
    id,
    json: objectToJSON(
      omit(data, ['profileLastFetchedAt', 'unblurredAvatarPath'])
    ),

    e164: e164 || null,
    uuid: uuid || null,

    active_at: active_at || null,
    type,
    members: membersList,
    name: name || null,
    profileName: profileName || null,
    profileFamilyName: profileFamilyName || null,
    profileFullName: combineNames(profileName, profileFamilyName) || null,
    profileLastFetchedAt: profileLastFetchedAt || null,
  });
}

async function updateConversations(
  array: Array<ConversationType>
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const item of array) {
      updateConversation(item);
    }
  })();
}

async function removeConversation(id: Array<string> | string): Promise<void> {
  const db = getInstance();
  if (!Array.isArray(id)) {
    db.prepare<Query>('DELETE FROM conversations WHERE id = $id;').run({
      id,
    });

    return;
  }

  if (!id.length) {
    throw new Error('removeConversation: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  db.prepare<ArrayQuery>(
    `
    DELETE FROM conversations
    WHERE id IN ( ${id.map(() => '?').join(', ')} );
    `
  ).run(id);
}

async function getConversationById(
  id: string
): Promise<ConversationType | undefined> {
  const db = getInstance();
  const row: { json: string } = db
    .prepare<Query>('SELECT json FROM conversations WHERE id = $id;')
    .get({ id });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}

async function eraseStorageServiceStateFromConversations(): Promise<void> {
  const db = getInstance();

  db.prepare<EmptyQuery>(
    `
    UPDATE conversations
    SET
      json = json_remove(json, '$.storageID', '$.needsStorageServiceSync', '$.unknownFields', '$.storageProfileKey');
    `
  ).run();
}

async function getAllConversations(): Promise<Array<ConversationType>> {
  const db = getInstance();
  const rows: ConversationRows = db
    .prepare<EmptyQuery>(
      `
      SELECT json, profileLastFetchedAt
      FROM conversations
      ORDER BY id ASC;
      `
    )
    .all();

  return rows.map(row => rowToConversation(row));
}

async function getAllConversationIds(): Promise<Array<string>> {
  const db = getInstance();
  const rows: Array<{ id: string }> = db
    .prepare<EmptyQuery>(
      `
      SELECT id FROM conversations ORDER BY id ASC;
      `
    )
    .all();

  return rows.map(row => row.id);
}

async function getAllPrivateConversations(): Promise<Array<ConversationType>> {
  const db = getInstance();
  const rows: ConversationRows = db
    .prepare<EmptyQuery>(
      `
      SELECT json, profileLastFetchedAt
      FROM conversations
      WHERE type = 'private'
      ORDER BY id ASC;
      `
    )
    .all();

  return rows.map(row => rowToConversation(row));
}

async function getAllGroupsInvolvingId(
  id: string
): Promise<Array<ConversationType>> {
  const db = getInstance();
  const rows: ConversationRows = db
    .prepare<Query>(
      `
      SELECT json, profileLastFetchedAt
      FROM conversations WHERE
        type = 'group' AND
        members LIKE $id
      ORDER BY id ASC;
      `
    )
    .all({
      id: `%${id}%`,
    });

  return rows.map(row => rowToConversation(row));
}

async function searchConversations(
  query: string,
  { limit }: { limit?: number } = {}
): Promise<Array<ConversationType>> {
  const db = getInstance();
  const rows: ConversationRows = db
    .prepare<Query>(
      `
      SELECT json, profileLastFetchedAt
      FROM conversations WHERE
        (
          e164 LIKE $query OR
          name LIKE $query OR
          profileFullName LIKE $query
        )
      ORDER BY active_at DESC
      LIMIT $limit
      `
    )
    .all({
      query: `%${query}%`,
      limit: limit || 100,
    });

  return rows.map(row => rowToConversation(row));
}

async function searchMessages(
  query: string,
  params: { limit?: number; conversationId?: string } = {}
): Promise<Array<SearchResultMessageType>> {
  const { limit = 500, conversationId } = params;

  const db = getInstance();

  // sqlite queries with a join on a virtual table (like FTS5) are de-optimized
  // and can't use indices for ordering results. Instead an in-memory index of
  // the join rows is sorted on the fly, and this becomes substantially
  // slower when there are large columns in it (like `messages.json`).
  //
  // Thus here we take an indirect approach and store `rowid`s in a temporary
  // table for all messages that match the FTS query. Then we create another
  // table to sort and limit the results, and finally join on it when fetch
  // the snippets and json. The benefit of this is that the `ORDER BY` and
  // `LIMIT` happen without virtual table and are thus covered by
  // `messages_searchOrder` index.
  return db.transaction(() => {
    db.exec(
      `
      CREATE TEMP TABLE tmp_results(rowid INTEGER PRIMARY KEY ASC);
      CREATE TEMP TABLE tmp_filtered_results(rowid INTEGER PRIMARY KEY ASC);
      `
    );

    db.prepare<Query>(
      `
        INSERT INTO tmp_results (rowid)
        SELECT
          rowid
        FROM
          messages_fts
        WHERE
          messages_fts.body MATCH $query;
      `
    ).run({ query });

    if (conversationId === undefined) {
      db.prepare<Query>(
        `
          INSERT INTO tmp_filtered_results (rowid)
          SELECT
            tmp_results.rowid
          FROM
            tmp_results
          INNER JOIN
            messages ON messages.rowid = tmp_results.rowid
          ORDER BY messages.received_at DESC, messages.sent_at DESC
          LIMIT $limit;
        `
      ).run({ limit });
    } else {
      db.prepare<Query>(
        `
          INSERT INTO tmp_filtered_results (rowid)
          SELECT
            tmp_results.rowid
          FROM
            tmp_results
          INNER JOIN
            messages ON messages.rowid = tmp_results.rowid
          WHERE
            messages.conversationId = $conversationId
          ORDER BY messages.received_at DESC, messages.sent_at DESC
          LIMIT $limit;
        `
      ).run({ conversationId, limit });
    }

    // The `MATCH` is necessary in order to for `snippet()` helper function to
    // give us the right results. We can't call `snippet()` in the query above
    // because it would bloat the temporary table with text data and we want
    // to keep its size minimal for `ORDER BY` + `LIMIT` to be fast.
    const result = db
      .prepare<Query>(
        `
        SELECT
          messages.json,
          snippet(messages_fts, -1, '<<left>>', '<<right>>', '...', 10)
            AS snippet
        FROM tmp_filtered_results
        INNER JOIN messages_fts
          ON messages_fts.rowid = tmp_filtered_results.rowid
        INNER JOIN messages
          ON messages.rowid = tmp_filtered_results.rowid
        WHERE
          messages_fts.body MATCH $query
        ORDER BY messages.received_at DESC, messages.sent_at DESC;
        `
      )
      .all({ query });

    db.exec(
      `
      DROP TABLE tmp_results;
      DROP TABLE tmp_filtered_results;
      `
    );

    return result;
  })();
}

async function searchMessagesInConversation(
  query: string,
  conversationId: string,
  { limit = 100 }: { limit?: number } = {}
): Promise<Array<SearchResultMessageType>> {
  return searchMessages(query, { conversationId, limit });
}

async function getMessageCount(conversationId?: string): Promise<number> {
  const db = getInstance();
  let row: { 'count(*)': number } | undefined;

  if (conversationId !== undefined) {
    row = db
      .prepare<Query>(
        `
        SELECT count(*)
        FROM messages
        WHERE conversationId = $conversationId;
        `
      )
      .get({ conversationId });
  } else {
    row = db.prepare<EmptyQuery>('SELECT count(*) FROM messages;').get();
  }

  if (!row) {
    throw new Error('getMessageCount: Unable to get count of messages');
  }

  return row['count(*)'];
}

async function saveMessage(
  data: MessageType,
  options: { forceSave?: boolean; alreadyInTransaction?: boolean } = {}
): Promise<string> {
  const db = getInstance();

  const { forceSave, alreadyInTransaction } = options;

  if (!alreadyInTransaction) {
    return db.transaction(() => {
      return saveMessage(data, {
        ...options,
        alreadyInTransaction: true,
      });
    })();
  }

  const {
    body,
    conversationId,
    expires_at,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
    id,
    isErased,
    isViewOnce,
    received_at,
    schemaVersion,
    sent_at,
    source,
    sourceUuid,
    sourceDevice,
    type,
    unread,
    expireTimer,
    expirationStartTimestamp,
  } = data;

  const payload = {
    id,
    json: objectToJSON(data),

    body: body || null,
    conversationId,
    expirationStartTimestamp: expirationStartTimestamp || null,
    expires_at: expires_at || null,
    expireTimer: expireTimer || null,
    hasAttachments: hasAttachments ? 1 : 0,
    hasFileAttachments: hasFileAttachments ? 1 : 0,
    hasVisualMediaAttachments: hasVisualMediaAttachments ? 1 : 0,
    isErased: isErased ? 1 : 0,
    isViewOnce: isViewOnce ? 1 : 0,
    received_at: received_at || null,
    schemaVersion,
    sent_at: sent_at || null,
    source: source || null,
    sourceUuid: sourceUuid || null,
    sourceDevice: sourceDevice || null,
    type: type || null,
    unread: unread ? 1 : 0,
  };

  if (id && !forceSave) {
    prepare(
      db,
      `
      UPDATE messages SET
        id = $id,
        json = $json,

        body = $body,
        conversationId = $conversationId,
        expirationStartTimestamp = $expirationStartTimestamp,
        expires_at = $expires_at,
        expireTimer = $expireTimer,
        hasAttachments = $hasAttachments,
        hasFileAttachments = $hasFileAttachments,
        hasVisualMediaAttachments = $hasVisualMediaAttachments,
        isErased = $isErased,
        isViewOnce = $isViewOnce,
        received_at = $received_at,
        schemaVersion = $schemaVersion,
        sent_at = $sent_at,
        source = $source,
        sourceUuid = $sourceUuid,
        sourceDevice = $sourceDevice,
        type = $type,
        unread = $unread
      WHERE id = $id;
      `
    ).run(payload);

    return id;
  }

  const toCreate = {
    ...data,
    id: id || generateUUID(),
  };

  prepare(
    db,
    `
    INSERT INTO messages (
      id,
      json,

      body,
      conversationId,
      expirationStartTimestamp,
      expires_at,
      expireTimer,
      hasAttachments,
      hasFileAttachments,
      hasVisualMediaAttachments,
      isErased,
      isViewOnce,
      received_at,
      schemaVersion,
      sent_at,
      source,
      sourceUuid,
      sourceDevice,
      type,
      unread
    ) values (
      $id,
      $json,

      $body,
      $conversationId,
      $expirationStartTimestamp,
      $expires_at,
      $expireTimer,
      $hasAttachments,
      $hasFileAttachments,
      $hasVisualMediaAttachments,
      $isErased,
      $isViewOnce,
      $received_at,
      $schemaVersion,
      $sent_at,
      $source,
      $sourceUuid,
      $sourceDevice,
      $type,
      $unread
    );
    `
  ).run({
    ...payload,
    id: toCreate.id,
    json: objectToJSON(toCreate),
  });

  return toCreate.id;
}

async function saveMessages(
  arrayOfMessages: Array<MessageType>,
  { forceSave }: { forceSave?: boolean } = {}
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const message of arrayOfMessages) {
      saveMessage(message, { forceSave, alreadyInTransaction: true });
    }
  })();
}

async function removeMessage(id: string): Promise<void> {
  const db = getInstance();

  db.prepare<Query>('DELETE FROM messages WHERE id = $id;').run({ id });
}

async function removeMessages(ids: Array<string>): Promise<void> {
  const db = getInstance();

  db.prepare<ArrayQuery>(
    `
    DELETE FROM messages
    WHERE id IN ( ${ids.map(() => '?').join(', ')} );
    `
  ).run(ids);
}

async function getMessageById(id: string): Promise<MessageType | undefined> {
  const db = getInstance();
  const row = db.prepare<Query>('SELECT * FROM messages WHERE id = $id;').get({
    id,
  });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}

async function _getAllMessages(): Promise<Array<MessageType>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<EmptyQuery>('SELECT json FROM messages ORDER BY id ASC;')
    .all();

  return rows.map(row => jsonToObject(row.json));
}

async function getAllMessageIds(): Promise<Array<string>> {
  const db = getInstance();
  const rows: Array<{ id: string }> = db
    .prepare<EmptyQuery>('SELECT id FROM messages ORDER BY id ASC;')
    .all();

  return rows.map(row => row.id);
}

async function getMessageBySender({
  source,
  sourceUuid,
  sourceDevice,
  sent_at,
}: {
  source: string;
  sourceUuid: string;
  sourceDevice: string;
  sent_at: number;
}): Promise<Array<MessageType>> {
  const db = getInstance();
  const rows: JSONRows = prepare(
    db,
    `
    SELECT json FROM messages WHERE
      (source = $source OR sourceUuid = $sourceUuid) AND
      sourceDevice = $sourceDevice AND
      sent_at = $sent_at;
    `
  ).all({
    source,
    sourceUuid,
    sourceDevice,
    sent_at,
  });

  return rows.map(row => jsonToObject(row.json));
}

async function getUnreadByConversation(
  conversationId: string
): Promise<Array<MessageType>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json FROM messages WHERE
        unread = $unread AND
        conversationId = $conversationId
      ORDER BY received_at DESC, sent_at DESC;
      `
    )
    .all({
      unread: 1,
      conversationId,
    });

  return rows.map(row => jsonToObject(row.json));
}

async function getOlderMessagesByConversation(
  conversationId: string,
  {
    limit = 100,
    receivedAt = Number.MAX_VALUE,
    sentAt = Number.MAX_VALUE,
    messageId,
  }: {
    limit?: number;
    receivedAt?: number;
    sentAt?: number;
    messageId?: string;
  } = {}
): Promise<Array<MessageTypeUnhydrated>> {
  const db = getInstance();
  let rows: JSONRows;

  if (messageId) {
    rows = db
      .prepare<Query>(
        `
        SELECT json FROM messages WHERE
          conversationId = $conversationId AND
          id != $messageId AND
          (
            (received_at = $received_at AND sent_at < $sent_at) OR
            received_at < $received_at
          )
        ORDER BY received_at DESC, sent_at DESC
        LIMIT $limit;
        `
      )
      .all({
        conversationId,
        received_at: receivedAt,
        sent_at: sentAt,
        limit,
        messageId,
      });
  } else {
    rows = db
      .prepare<Query>(
        `
        SELECT json FROM messages WHERE
        conversationId = $conversationId AND
        (
          (received_at = $received_at AND sent_at < $sent_at) OR
          received_at < $received_at
        )
        ORDER BY received_at DESC, sent_at DESC
        LIMIT $limit;
        `
      )
      .all({
        conversationId,
        received_at: receivedAt,
        sent_at: sentAt,
        limit,
      });
  }

  return rows.reverse();
}

async function getNewerMessagesByConversation(
  conversationId: string,
  {
    limit = 100,
    receivedAt = 0,
    sentAt = 0,
  }: { limit?: number; receivedAt?: number; sentAt?: number } = {}
): Promise<Array<MessageTypeUnhydrated>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json FROM messages WHERE
        conversationId = $conversationId AND
        (
          (received_at = $received_at AND sent_at > $sent_at) OR
          received_at > $received_at
        )
      ORDER BY received_at ASC, sent_at ASC
      LIMIT $limit;
      `
    )
    .all({
      conversationId,
      received_at: receivedAt,
      sent_at: sentAt,
      limit,
    });

  return rows;
}
function getOldestMessageForConversation(
  conversationId: string
): MessageMetricsType | undefined {
  const db = getInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT * FROM messages WHERE
        conversationId = $conversationId
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
      `
    )
    .get({
      conversationId,
    });

  if (!row) {
    return undefined;
  }

  return row;
}
function getNewestMessageForConversation(
  conversationId: string
): MessageMetricsType | undefined {
  const db = getInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT * FROM messages WHERE
        conversationId = $conversationId
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
      `
    )
    .get({
      conversationId,
    });

  if (!row) {
    return undefined;
  }

  return row;
}

async function getLastConversationActivity({
  conversationId,
  ourConversationId,
}: {
  conversationId: string;
  ourConversationId: string;
}): Promise<MessageType | undefined> {
  const db = getInstance();
  const row = prepare(
    db,
    `
      SELECT json FROM messages
      WHERE
        conversationId = $conversationId AND
        (type IS NULL
          OR
          type NOT IN (
            'profile-change',
            'verified-change',
            'message-history-unsynced',
            'keychange',
            'group-v1-migration'
          )
        ) AND
        (
          json_extract(json, '$.expirationTimerUpdate.fromSync') IS NULL
          OR
          json_extract(json, '$.expirationTimerUpdate.fromSync') != 1
        ) AND NOT
        (
          type = 'group-v2-change' AND
          json_extract(json, '$.groupV2Change.from') != $ourConversationId AND
          json_extract(json, '$.groupV2Change.details.length') = 1 AND
          json_extract(json, '$.groupV2Change.details[0].type') = 'member-remove' AND
          json_extract(json, '$.groupV2Change.details[0].conversationId') != $ourConversationId
        )
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
      `
  ).get({
    conversationId,
    ourConversationId,
  });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}
async function getLastConversationPreview({
  conversationId,
  ourConversationId,
}: {
  conversationId: string;
  ourConversationId: string;
}): Promise<MessageType | undefined> {
  const db = getInstance();
  const row = prepare(
    db,
    `
      SELECT json FROM messages
      WHERE
        conversationId = $conversationId AND
        (
          type IS NULL
          OR
          type NOT IN (
            'profile-change',
            'verified-change',
            'message-history-unsynced',
            'group-v1-migration'
          )
        ) AND NOT
        (
          type = 'group-v2-change' AND
          json_extract(json, '$.groupV2Change.from') != $ourConversationId AND
          json_extract(json, '$.groupV2Change.details.length') = 1 AND
          json_extract(json, '$.groupV2Change.details[0].type') = 'member-remove' AND
          json_extract(json, '$.groupV2Change.details[0].conversationId') != $ourConversationId
        )
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
      `
  ).get({
    conversationId,
    ourConversationId,
  });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}
function getOldestUnreadMessageForConversation(
  conversationId: string
): MessageMetricsType | undefined {
  const db = getInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT * FROM messages WHERE
        conversationId = $conversationId AND
        unread = 1
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
      `
    )
    .get({
      conversationId,
    });

  if (!row) {
    return undefined;
  }

  return row;
}

function getTotalUnreadForConversation(conversationId: string): number {
  const db = getInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT count(id)
      FROM messages
      WHERE
        conversationId = $conversationId AND
        unread = 1;
      `
    )
    .get({
      conversationId,
    });

  if (!row) {
    throw new Error('getTotalUnreadForConversation: Unable to get count');
  }

  return row['count(id)'];
}

async function getMessageMetricsForConversation(
  conversationId: string
): Promise<ConversationMetricsType> {
  const oldest = getOldestMessageForConversation(conversationId);
  const newest = getNewestMessageForConversation(conversationId);
  const oldestUnread = getOldestUnreadMessageForConversation(conversationId);
  const totalUnread = getTotalUnreadForConversation(conversationId);

  return {
    oldest: oldest ? pick(oldest, ['received_at', 'sent_at', 'id']) : undefined,
    newest: newest ? pick(newest, ['received_at', 'sent_at', 'id']) : undefined,
    oldestUnread: oldestUnread
      ? pick(oldestUnread, ['received_at', 'sent_at', 'id'])
      : undefined,
    totalUnread,
  };
}

async function hasGroupCallHistoryMessage(
  conversationId: string,
  eraId: string
): Promise<boolean> {
  const db = getInstance();

  const row: { 'count(*)': number } | undefined = db
    .prepare<Query>(
      `
      SELECT count(*) FROM messages
      WHERE conversationId = $conversationId
      AND type = 'call-history'
      AND json_extract(json, '$.callHistoryDetails.callMode') = 'Group'
      AND json_extract(json, '$.callHistoryDetails.eraId') = $eraId
      LIMIT 1;
      `
    )
    .get({
      conversationId,
      eraId,
    });

  if (row) {
    return Boolean(row['count(*)']);
  }
  return false;
}

async function migrateConversationMessages(
  obsoleteId: string,
  currentId: string
): Promise<void> {
  const db = getInstance();

  db.prepare<Query>(
    `
    UPDATE messages SET
      conversationId = $currentId,
      json = json_set(json, '$.conversationId', $currentId)
    WHERE conversationId = $obsoleteId;
    `
  ).run({
    obsoleteId,
    currentId,
  });
}

async function getMessagesBySentAt(
  sentAt: number
): Promise<Array<MessageType>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json FROM messages
      WHERE sent_at = $sent_at
      ORDER BY received_at DESC, sent_at DESC;
      `
    )
    .all({
      sent_at: sentAt,
    });

  return rows.map(row => jsonToObject(row.json));
}

async function getExpiredMessages(): Promise<Array<MessageType>> {
  const db = getInstance();
  const now = Date.now();

  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json FROM messages WHERE
        expires_at IS NOT NULL AND
        expires_at <= $expires_at
      ORDER BY expires_at ASC;
      `
    )
    .all({
      expires_at: now,
    });

  return rows.map(row => jsonToObject(row.json));
}

async function getOutgoingWithoutExpiresAt(): Promise<Array<MessageType>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<EmptyQuery>(
      `
      SELECT json FROM messages
      INDEXED BY messages_without_timer
      WHERE
        expireTimer > 0 AND
        expires_at IS NULL AND
        type IS 'outgoing'
      ORDER BY expires_at ASC;
      `
    )
    .all();

  return rows.map(row => jsonToObject(row.json));
}

async function getNextExpiringMessage(): Promise<MessageType | undefined> {
  const db = getInstance();

  // Note: we avoid 'IS NOT NULL' here because it does seem to bypass our index
  const rows: JSONRows = db
    .prepare<EmptyQuery>(
      `
      SELECT json FROM messages
      WHERE expires_at > 0
      ORDER BY expires_at ASC
      LIMIT 1;
      `
    )
    .all();

  if (!rows || rows.length < 1) {
    return undefined;
  }

  return jsonToObject(rows[0].json);
}

async function getNextTapToViewMessageToAgeOut(): Promise<
  MessageType | undefined
> {
  const db = getInstance();
  const rows = db
    .prepare<EmptyQuery>(
      `
      SELECT json FROM messages
      WHERE
        isViewOnce = 1
        AND (isErased IS NULL OR isErased != 1)
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
      `
    )
    .all();

  if (!rows || rows.length < 1) {
    return undefined;
  }

  return jsonToObject(rows[0].json);
}

async function getTapToViewMessagesNeedingErase(): Promise<Array<MessageType>> {
  const db = getInstance();
  const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json
      FROM messages
      WHERE
        isViewOnce = 1
        AND (isErased IS NULL OR isErased != 1)
        AND received_at <= $THIRTY_DAYS_AGO
      ORDER BY received_at ASC, sent_at ASC;
      `
    )
    .all({
      THIRTY_DAYS_AGO,
    });

  return rows.map(row => jsonToObject(row.json));
}

async function saveUnprocessed(
  data: UnprocessedType,
  { forceSave }: { forceSave?: boolean } = {}
): Promise<string> {
  const db = getInstance();
  const { id, timestamp, version, attempts, envelope } = data;
  if (!id) {
    throw new Error('saveUnprocessed: id was falsey');
  }

  if (forceSave) {
    prepare(
      db,
      `
      INSERT INTO unprocessed (
        id,
        timestamp,
        version,
        attempts,
        envelope
      ) values (
        $id,
        $timestamp,
        $version,
        $attempts,
        $envelope
      );
      `
    ).run({
      id,
      timestamp,
      version,
      attempts,
      envelope,
    });

    return id;
  }

  prepare(
    db,
    `
    UPDATE unprocessed SET
      timestamp = $timestamp,
      version = $version,
      attempts = $attempts,
      envelope = $envelope
    WHERE id = $id;
    `
  ).run({
    id,
    timestamp,
    version,
    attempts,
    envelope,
  });

  return id;
}

async function saveUnprocesseds(
  arrayOfUnprocessed: Array<UnprocessedType>,
  { forceSave }: { forceSave?: boolean } = {}
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const unprocessed of arrayOfUnprocessed) {
      saveUnprocessed(unprocessed, { forceSave });
    }
  })();
}

async function updateUnprocessedAttempts(
  id: string,
  attempts: number
): Promise<void> {
  const db = getInstance();
  db.prepare<Query>(
    `
    UPDATE unprocessed
    SET attempts = $attempts
    WHERE id = $id;
    `
  ).run({
    id,
    attempts,
  });
}
async function updateUnprocessedWithData(
  id: string,
  data: UnprocessedType
): Promise<void> {
  const db = getInstance();
  const { source, sourceUuid, sourceDevice, serverTimestamp, decrypted } = data;

  prepare(
    db,
    `
    UPDATE unprocessed SET
      source = $source,
      sourceUuid = $sourceUuid,
      sourceDevice = $sourceDevice,
      serverTimestamp = $serverTimestamp,
      decrypted = $decrypted
    WHERE id = $id;
    `
  ).run({
    id,
    source: source || null,
    sourceUuid: sourceUuid || null,
    sourceDevice: sourceDevice || null,
    serverTimestamp: serverTimestamp || null,
    decrypted: decrypted || null,
  });
}
async function updateUnprocessedsWithData(
  arrayOfUnprocessed: Array<{ id: string; data: UnprocessedType }>
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const { id, data } of arrayOfUnprocessed) {
      updateUnprocessedWithData(id, data);
    }
  })();
}

async function getUnprocessedById(
  id: string
): Promise<UnprocessedType | undefined> {
  const db = getInstance();
  const row = db
    .prepare<Query>('SELECT * FROM unprocessed WHERE id = $id;')
    .get({
      id,
    });

  return row;
}

async function getUnprocessedCount(): Promise<number> {
  const db = getInstance();
  const row = db.prepare<EmptyQuery>('SELECT count(*) from unprocessed;').get();

  if (!row) {
    throw new Error('getUnprocessedCount: Unable to get count of unprocessed');
  }

  return row['count(*)'];
}

async function getAllUnprocessed(): Promise<Array<UnprocessedType>> {
  const db = getInstance();
  const rows = db
    .prepare<EmptyQuery>(
      `
      SELECT *
      FROM unprocessed
      ORDER BY timestamp ASC;
      `
    )
    .all();

  return rows;
}

async function removeUnprocessed(id: string | Array<string>): Promise<void> {
  const db = getInstance();

  if (!Array.isArray(id)) {
    prepare(db, 'DELETE FROM unprocessed WHERE id = $id;').run({ id });

    return;
  }

  if (!id.length) {
    throw new Error('removeUnprocessed: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  db.prepare<ArrayQuery>(
    `
    DELETE FROM unprocessed
    WHERE id IN ( ${id.map(() => '?').join(', ')} );
    `
  ).run(id);
}

async function removeAllUnprocessed(): Promise<void> {
  const db = getInstance();
  db.prepare<EmptyQuery>('DELETE FROM unprocessed;').run();
}

// Attachment Downloads

const ATTACHMENT_DOWNLOADS_TABLE = 'attachment_downloads';
async function getNextAttachmentDownloadJobs(
  limit?: number,
  options: { timestamp?: number } = {}
): Promise<Array<AttachmentDownloadJobType>> {
  const db = getInstance();
  const timestamp =
    options && options.timestamp ? options.timestamp : Date.now();

  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json
      FROM attachment_downloads
      WHERE pending = 0 AND timestamp < $timestamp
      ORDER BY timestamp DESC
      LIMIT $limit;
      `
    )
    .all({
      limit: limit || 3,
      timestamp,
    });

  return rows.map(row => jsonToObject(row.json));
}
async function saveAttachmentDownloadJob(
  job: AttachmentDownloadJobType
): Promise<void> {
  const db = getInstance();
  const { id, pending, timestamp } = job;
  if (!id) {
    throw new Error(
      'saveAttachmentDownloadJob: Provided job did not have a truthy id'
    );
  }

  db.prepare<Query>(
    `
    INSERT OR REPLACE INTO attachment_downloads (
      id,
      pending,
      timestamp,
      json
    ) values (
      $id,
      $pending,
      $timestamp,
      $json
    )
    `
  ).run({
    id,
    pending,
    timestamp,
    json: objectToJSON(job),
  });
}
async function setAttachmentDownloadJobPending(
  id: string,
  pending: boolean
): Promise<void> {
  const db = getInstance();
  db.prepare<Query>(
    `
    UPDATE attachment_downloads
    SET pending = $pending
    WHERE id = $id;
    `
  ).run({
    id,
    pending: pending ? 1 : 0,
  });
}
async function resetAttachmentDownloadPending(): Promise<void> {
  const db = getInstance();
  db.prepare<EmptyQuery>(
    `
    UPDATE attachment_downloads
    SET pending = 0
    WHERE pending != 0;
    `
  ).run();
}
function removeAttachmentDownloadJob(id: string): Promise<void> {
  return removeById(ATTACHMENT_DOWNLOADS_TABLE, id);
}
function removeAllAttachmentDownloadJobs(): Promise<void> {
  return removeAllFromTable(ATTACHMENT_DOWNLOADS_TABLE);
}

// Stickers

async function createOrUpdateStickerPack(pack: StickerPackType): Promise<void> {
  const db = getInstance();
  const {
    attemptedStatus,
    author,
    coverStickerId,
    createdAt,
    downloadAttempts,
    id,
    installedAt,
    key,
    lastUsed,
    status,
    stickerCount,
    title,
  } = pack;
  if (!id) {
    throw new Error(
      'createOrUpdateStickerPack: Provided data did not have a truthy id'
    );
  }

  const rows = db
    .prepare<Query>(
      `
      SELECT id
      FROM sticker_packs
      WHERE id = $id;
      `
    )
    .all({ id });
  const payload = {
    attemptedStatus,
    author,
    coverStickerId,
    createdAt: createdAt || Date.now(),
    downloadAttempts: downloadAttempts || 1,
    id,
    installedAt,
    key,
    lastUsed: lastUsed || null,
    status,
    stickerCount,
    title,
  };

  if (rows && rows.length) {
    db.prepare<Query>(
      `
      UPDATE sticker_packs SET
        attemptedStatus = $attemptedStatus,
        author = $author,
        coverStickerId = $coverStickerId,
        createdAt = $createdAt,
        downloadAttempts = $downloadAttempts,
        installedAt = $installedAt,
        key = $key,
        lastUsed = $lastUsed,
        status = $status,
        stickerCount = $stickerCount,
        title = $title
      WHERE id = $id;
      `
    ).run(payload);

    return;
  }

  db.prepare<Query>(
    `
    INSERT INTO sticker_packs (
      attemptedStatus,
      author,
      coverStickerId,
      createdAt,
      downloadAttempts,
      id,
      installedAt,
      key,
      lastUsed,
      status,
      stickerCount,
      title
    ) values (
      $attemptedStatus,
      $author,
      $coverStickerId,
      $createdAt,
      $downloadAttempts,
      $id,
      $installedAt,
      $key,
      $lastUsed,
      $status,
      $stickerCount,
      $title
    )
    `
  ).run(payload);
}
async function updateStickerPackStatus(
  id: string,
  status: StickerPackStatusType,
  options?: { timestamp: number }
): Promise<void> {
  const db = getInstance();
  const timestamp = options ? options.timestamp || Date.now() : Date.now();
  const installedAt = status === 'installed' ? timestamp : null;

  db.prepare<Query>(
    `
    UPDATE sticker_packs
    SET status = $status, installedAt = $installedAt
    WHERE id = $id;
    `
  ).run({
    id,
    status,
    installedAt,
  });
}
async function clearAllErrorStickerPackAttempts(): Promise<void> {
  const db = getInstance();

  db.prepare<EmptyQuery>(
    `
    UPDATE sticker_packs
    SET downloadAttempts = 0
    WHERE status = 'error';
    `
  ).run();
}
async function createOrUpdateSticker(sticker: StickerType): Promise<void> {
  const db = getInstance();
  const {
    emoji,
    height,
    id,
    isCoverOnly,
    lastUsed,
    packId,
    path,
    width,
  } = sticker;

  if (!isNumber(id)) {
    throw new Error(
      'createOrUpdateSticker: Provided data did not have a numeric id'
    );
  }
  if (!packId) {
    throw new Error(
      'createOrUpdateSticker: Provided data did not have a truthy id'
    );
  }

  db.prepare<Query>(
    `
    INSERT OR REPLACE INTO stickers (
      emoji,
      height,
      id,
      isCoverOnly,
      lastUsed,
      packId,
      path,
      width
    ) values (
      $emoji,
      $height,
      $id,
      $isCoverOnly,
      $lastUsed,
      $packId,
      $path,
      $width
    )
    `
  ).run({
    emoji,
    height,
    id,
    isCoverOnly: isCoverOnly ? 1 : 0,
    lastUsed: lastUsed || null,
    packId,
    path,
    width,
  });
}
async function updateStickerLastUsed(
  packId: string,
  stickerId: number,
  lastUsed: number
): Promise<void> {
  const db = getInstance();
  db.prepare<Query>(
    `
    UPDATE stickers
    SET lastUsed = $lastUsed
    WHERE id = $id AND packId = $packId;
    `
  ).run({
    id: stickerId,
    packId,
    lastUsed,
  });
  db.prepare<Query>(
    `
    UPDATE sticker_packs
    SET lastUsed = $lastUsed
    WHERE id = $id;
    `
  ).run({
    id: packId,
    lastUsed,
  });
}
async function addStickerPackReference(
  messageId: string,
  packId: string
): Promise<void> {
  const db = getInstance();

  if (!messageId) {
    throw new Error(
      'addStickerPackReference: Provided data did not have a truthy messageId'
    );
  }
  if (!packId) {
    throw new Error(
      'addStickerPackReference: Provided data did not have a truthy packId'
    );
  }

  db.prepare<Query>(
    `
    INSERT OR REPLACE INTO sticker_references (
      messageId,
      packId
    ) values (
      $messageId,
      $packId
    )
    `
  ).run({
    messageId,
    packId,
  });
}
async function deleteStickerPackReference(
  messageId: string,
  packId: string
): Promise<Array<string>> {
  const db = getInstance();

  if (!messageId) {
    throw new Error(
      'addStickerPackReference: Provided data did not have a truthy messageId'
    );
  }
  if (!packId) {
    throw new Error(
      'addStickerPackReference: Provided data did not have a truthy packId'
    );
  }

  return db
    .transaction(() => {
      // We use an immediate transaction here to immediately acquire an exclusive lock,
      //   which would normally only happen when we did our first write.

      // We need this to ensure that our five queries are all atomic, with no
      // other changes happening while we do it:
      // 1. Delete our target messageId/packId references
      // 2. Check the number of references still pointing at packId
      // 3. If that number is zero, get pack from sticker_packs database
      // 4. If it's not installed, then grab all of its sticker paths
      // 5. If it's not installed, then sticker pack (which cascades to all
      //    stickers and references)
      db.prepare<Query>(
        `
        DELETE FROM sticker_references
        WHERE messageId = $messageId AND packId = $packId;
        `
      ).run({
        messageId,
        packId,
      });

      const countRow = db
        .prepare<Query>(
          `
          SELECT count(*) FROM sticker_references
          WHERE packId = $packId;
          `
        )
        .get({ packId });
      if (!countRow) {
        throw new Error(
          'deleteStickerPackReference: Unable to get count of references'
        );
      }
      const count = countRow['count(*)'];
      if (count > 0) {
        return [];
      }

      const packRow: { status: StickerPackStatusType } = db
        .prepare<Query>(
          `
          SELECT status FROM sticker_packs
          WHERE id = $packId;
          `
        )
        .get({ packId });
      if (!packRow) {
        console.log('deleteStickerPackReference: did not find referenced pack');
        return [];
      }
      const { status } = packRow;

      if (status === 'installed') {
        return [];
      }

      const stickerPathRows: Array<{ path: string }> = db
        .prepare<Query>(
          `
          SELECT path FROM stickers
          WHERE packId = $packId;
          `
        )
        .all({
          packId,
        });
      db.prepare<Query>(
        `
        DELETE FROM sticker_packs
        WHERE id = $packId;
        `
      ).run({
        packId,
      });

      return (stickerPathRows || []).map(row => row.path);
    })
    .immediate();
}

async function deleteStickerPack(packId: string): Promise<Array<string>> {
  const db = getInstance();

  if (!packId) {
    throw new Error(
      'deleteStickerPack: Provided data did not have a truthy packId'
    );
  }

  return db
    .transaction(() => {
      // We use an immediate transaction here to immediately acquire an exclusive lock,
      //   which would normally only happen when we did our first write.

      // We need this to ensure that our two queries are atomic, with no other changes
      //   happening while we do it:
      // 1. Grab all of target pack's sticker paths
      // 2. Delete sticker pack (which cascades to all stickers and references)

      const stickerPathRows: Array<{ path: string }> = db
        .prepare<Query>(
          `
          SELECT path FROM stickers
          WHERE packId = $packId;
          `
        )
        .all({
          packId,
        });
      db.prepare<Query>(
        `
        DELETE FROM sticker_packs
        WHERE id = $packId;
        `
      ).run({ packId });

      return (stickerPathRows || []).map(row => row.path);
    })
    .immediate();
}

async function getStickerCount(): Promise<number> {
  const db = getInstance();

  const row = db.prepare<EmptyQuery>('SELECT count(*) from stickers;').get();

  if (!row) {
    throw new Error('getStickerCount: Unable to get count of stickers');
  }

  return row['count(*)'];
}
async function getAllStickerPacks(): Promise<Array<StickerPackType>> {
  const db = getInstance();

  const rows = db
    .prepare<EmptyQuery>(
      `
      SELECT * FROM sticker_packs
      ORDER BY installedAt DESC, createdAt DESC
      `
    )
    .all();

  return rows || [];
}
async function getAllStickers(): Promise<Array<StickerType>> {
  const db = getInstance();

  const rows = db
    .prepare<EmptyQuery>(
      `
      SELECT * FROM stickers
      ORDER BY packId ASC, id ASC
      `
    )
    .all();

  return (rows || []).map(row => rowToSticker(row));
}
async function getRecentStickers({ limit }: { limit?: number } = {}): Promise<
  Array<StickerType>
> {
  const db = getInstance();

  // Note: we avoid 'IS NOT NULL' here because it does seem to bypass our index
  const rows = db
    .prepare<Query>(
      `
      SELECT stickers.* FROM stickers
      JOIN sticker_packs on stickers.packId = sticker_packs.id
      WHERE stickers.lastUsed > 0 AND sticker_packs.status = 'installed'
      ORDER BY stickers.lastUsed DESC
      LIMIT $limit
      `
    )
    .all({
      limit: limit || 24,
    });

  return (rows || []).map(row => rowToSticker(row));
}

// Emojis
async function updateEmojiUsage(
  shortName: string,
  timeUsed: number = Date.now()
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    const rows = db
      .prepare<Query>(
        `
        SELECT * FROM emojis
        WHERE shortName = $shortName;
        `
      )
      .get({
        shortName,
      });

    if (rows) {
      db.prepare<Query>(
        `
        UPDATE emojis
        SET lastUsage = $timeUsed
        WHERE shortName = $shortName;
        `
      ).run({ shortName, timeUsed });
    } else {
      db.prepare<Query>(
        `
        INSERT INTO emojis(shortName, lastUsage)
        VALUES ($shortName, $timeUsed);
        `
      ).run({ shortName, timeUsed });
    }
  })();
}

async function getRecentEmojis(limit = 32): Promise<Array<EmojiType>> {
  const db = getInstance();
  const rows = db
    .prepare<Query>(
      `
      SELECT *
      FROM emojis
      ORDER BY lastUsage DESC
      LIMIT $limit;
      `
    )
    .all({ limit });

  return rows || [];
}

// All data in database
async function removeAll(): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    db.exec(`
      DELETE FROM conversations;
      DELETE FROM identityKeys;
      DELETE FROM items;
      DELETE FROM messages;
      DELETE FROM preKeys;
      DELETE FROM sessions;
      DELETE FROM signedPreKeys;
      DELETE FROM unprocessed;
      DELETE FROM attachment_downloads;
      DELETE FROM messages_fts;
      DELETE FROM stickers;
      DELETE FROM sticker_packs;
      DELETE FROM sticker_references;
    `);
  })();
}

// Anything that isn't user-visible data
async function removeAllConfiguration(): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    db.exec(`
      DELETE FROM identityKeys;
      DELETE FROM items;
      DELETE FROM preKeys;
      DELETE FROM sessions;
      DELETE FROM signedPreKeys;
      DELETE FROM unprocessed;
    `);
  })();
}

async function getMessagesNeedingUpgrade(
  limit: number,
  { maxVersion }: { maxVersion: number }
): Promise<Array<MessageType>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json
      FROM messages
      WHERE schemaVersion IS NULL OR schemaVersion < $maxVersion
      LIMIT $limit;
      `
    )
    .all({
      maxVersion,
      limit,
    });

  return rows.map(row => jsonToObject(row.json));
}

async function getMessagesWithVisualMediaAttachments(
  conversationId: string,
  { limit }: { limit: number }
): Promise<Array<MessageType>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json FROM messages WHERE
        conversationId = $conversationId AND
        hasVisualMediaAttachments = 1
      ORDER BY received_at DESC, sent_at DESC
      LIMIT $limit;
      `
    )
    .all({
      conversationId,
      limit,
    });

  return rows.map(row => jsonToObject(row.json));
}

async function getMessagesWithFileAttachments(
  conversationId: string,
  { limit }: { limit: number }
): Promise<Array<MessageType>> {
  const db = getInstance();
  const rows = db
    .prepare<Query>(
      `
      SELECT json FROM messages WHERE
        conversationId = $conversationId AND
        hasFileAttachments = 1
      ORDER BY received_at DESC, sent_at DESC
      LIMIT $limit;
      `
    )
    .all({
      conversationId,
      limit,
    });

  return map(rows, row => jsonToObject(row.json));
}

function getExternalFilesForMessage(message: MessageType): Array<string> {
  const { attachments, contact, quote, preview, sticker } = message;
  const files: Array<string> = [];

  forEach(attachments, attachment => {
    const { path: file, thumbnail, screenshot } = attachment;
    if (file) {
      files.push(file);
    }

    if (thumbnail && thumbnail.path) {
      files.push(thumbnail.path);
    }

    if (screenshot && screenshot.path) {
      files.push(screenshot.path);
    }
  });

  if (quote && quote.attachments && quote.attachments.length) {
    forEach(quote.attachments, attachment => {
      const { thumbnail } = attachment;

      if (thumbnail && thumbnail.path) {
        files.push(thumbnail.path);
      }
    });
  }

  if (contact && contact.length) {
    forEach(contact, item => {
      const { avatar } = item;

      if (avatar && avatar.avatar && avatar.avatar.path) {
        files.push(avatar.avatar.path);
      }
    });
  }

  if (preview && preview.length) {
    forEach(preview, item => {
      const { image } = item;

      if (image && image.path) {
        files.push(image.path);
      }
    });
  }

  if (sticker && sticker.data && sticker.data.path) {
    files.push(sticker.data.path);

    if (sticker.data.thumbnail && sticker.data.thumbnail.path) {
      files.push(sticker.data.thumbnail.path);
    }
  }

  return files;
}

function getExternalFilesForConversation(
  conversation: Pick<ConversationType, 'avatar' | 'profileAvatar'>
): Array<string> {
  const { avatar, profileAvatar } = conversation;
  const files: Array<string> = [];

  if (avatar && avatar.path) {
    files.push(avatar.path);
  }

  if (profileAvatar && profileAvatar.path) {
    files.push(profileAvatar.path);
  }

  return files;
}

function getExternalDraftFilesForConversation(
  conversation: Pick<ConversationType, 'draftAttachments'>
): Array<string> {
  const draftAttachments = conversation.draftAttachments || [];
  const files: Array<string> = [];

  forEach(draftAttachments, attachment => {
    const { path: file, screenshotPath } = attachment;
    if (file) {
      files.push(file);
    }

    if (screenshotPath) {
      files.push(screenshotPath);
    }
  });

  return files;
}

async function removeKnownAttachments(
  allAttachments: Array<string>
): Promise<Array<string>> {
  const db = getInstance();
  const lookup: Dictionary<boolean> = fromPairs(
    map(allAttachments, file => [file, true])
  );
  const chunkSize = 50;

  const total = await getMessageCount();
  console.log(
    `removeKnownAttachments: About to iterate through ${total} messages`
  );

  let count = 0;
  let complete = false;
  let id: string | number = '';

  while (!complete) {
    const rows: JSONRows = db
      .prepare<Query>(
        `
        SELECT json FROM messages
        WHERE id > $id
        ORDER BY id ASC
        LIMIT $chunkSize;
        `
      )
      .all({
        id,
        chunkSize,
      });

    const messages: Array<MessageType> = rows.map(row =>
      jsonToObject(row.json)
    );
    messages.forEach(message => {
      const externalFiles = getExternalFilesForMessage(message);
      forEach(externalFiles, file => {
        delete lookup[file];
      });
    });

    const lastMessage: MessageType | undefined = last(messages);
    if (lastMessage) {
      ({ id } = lastMessage);
    }
    complete = messages.length < chunkSize;
    count += messages.length;
  }

  console.log(`removeKnownAttachments: Done processing ${count} messages`);

  complete = false;
  count = 0;
  // Though conversations.id is a string, this ensures that, when coerced, this
  //   value is still a string but it's smaller than every other string.
  id = 0;

  const conversationTotal = await getConversationCount();
  console.log(
    `removeKnownAttachments: About to iterate through ${conversationTotal} conversations`
  );

  while (!complete) {
    const rows = db
      .prepare<Query>(
        `
        SELECT json FROM conversations
        WHERE id > $id
        ORDER BY id ASC
        LIMIT $chunkSize;
        `
      )
      .all({
        id,
        chunkSize,
      });

    const conversations: Array<ConversationType> = map(rows, row =>
      jsonToObject(row.json)
    );
    conversations.forEach(conversation => {
      const externalFiles = getExternalFilesForConversation(conversation);
      externalFiles.forEach(file => {
        delete lookup[file];
      });
    });

    const lastMessage: ConversationType | undefined = last(conversations);
    if (lastMessage) {
      ({ id } = lastMessage);
    }
    complete = conversations.length < chunkSize;
    count += conversations.length;
  }

  console.log(`removeKnownAttachments: Done processing ${count} conversations`);

  return Object.keys(lookup);
}

async function removeKnownStickers(
  allStickers: Array<string>
): Promise<Array<string>> {
  const db = getInstance();
  const lookup: Dictionary<boolean> = fromPairs(
    map(allStickers, file => [file, true])
  );
  const chunkSize = 50;

  const total = getStickerCount();
  console.log(
    `removeKnownStickers: About to iterate through ${total} stickers`
  );

  let count = 0;
  let complete = false;
  let rowid = 0;

  while (!complete) {
    const rows: Array<{ rowid: number; path: string }> = db
      .prepare<Query>(
        `
        SELECT rowid, path FROM stickers
        WHERE rowid > $rowid
        ORDER BY rowid ASC
        LIMIT $chunkSize;
        `
      )
      .all({
        rowid,
        chunkSize,
      });

    const files: Array<string> = rows.map(row => row.path);
    files.forEach(file => {
      delete lookup[file];
    });

    const lastSticker = last(rows);
    if (lastSticker) {
      ({ rowid } = lastSticker);
    }
    complete = rows.length < chunkSize;
    count += rows.length;
  }

  console.log(`removeKnownStickers: Done processing ${count} stickers`);

  return Object.keys(lookup);
}

async function removeKnownDraftAttachments(
  allStickers: Array<string>
): Promise<Array<string>> {
  const db = getInstance();
  const lookup: Dictionary<boolean> = fromPairs(
    map(allStickers, file => [file, true])
  );
  const chunkSize = 50;

  const total = await getConversationCount();
  console.log(
    `removeKnownDraftAttachments: About to iterate through ${total} conversations`
  );

  let complete = false;
  let count = 0;
  // Though conversations.id is a string, this ensures that, when coerced, this
  //   value is still a string but it's smaller than every other string.
  let id: number | string = 0;

  while (!complete) {
    const rows: JSONRows = db
      .prepare<Query>(
        `
        SELECT json FROM conversations
        WHERE id > $id
        ORDER BY id ASC
        LIMIT $chunkSize;
        `
      )
      .all({
        id,
        chunkSize,
      });

    const conversations: Array<ConversationType> = rows.map(row =>
      jsonToObject(row.json)
    );
    conversations.forEach(conversation => {
      const externalFiles = getExternalDraftFilesForConversation(conversation);
      externalFiles.forEach(file => {
        delete lookup[file];
      });
    });

    const lastMessage: ConversationType | undefined = last(conversations);
    if (lastMessage) {
      ({ id } = lastMessage);
    }
    complete = conversations.length < chunkSize;
    count += conversations.length;
  }

  console.log(
    `removeKnownDraftAttachments: Done processing ${count} conversations`
  );

  return Object.keys(lookup);
}
