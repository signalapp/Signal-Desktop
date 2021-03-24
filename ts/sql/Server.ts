// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-nested-ternary */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { join } from 'path';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import PQueue from 'p-queue';
import sql from '@journeyapps/sqlcipher';

import pify from 'pify';
import { v4 as generateUUID } from 'uuid';
import {
  Dictionary,
  forEach,
  fromPairs,
  isNil,
  isNumber,
  isObject,
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
import { LocaleMessagesType } from '../types/I18N';

import {
  AttachmentDownloadJobType,
  ConversationType,
  IdentityKeyType,
  ItemType,
  MessageType,
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
import { applyQueueing } from './Queueing';

declare global {
  // We want to extend `Function`'s properties, so we need to use an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Function {
    needsSerial?: boolean;
  }
}

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

export default applyQueueing(dataInterface);

function objectToJSON(data: any) {
  return JSON.stringify(data);
}
function jsonToObject(json: string): any {
  return JSON.parse(json);
}
function rowToConversation(
  row: Readonly<{
    json: string;
    profileLastFetchedAt: null | number;
  }>
): ConversationType {
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

function isRenderer() {
  if (typeof process === 'undefined' || !process) {
    return true;
  }

  return process.type === 'renderer';
}

async function openDatabase(filePath: string): Promise<sql.Database> {
  return new Promise((resolve, reject) => {
    let instance: sql.Database | undefined;
    const callback = (error: Error | null) => {
      if (error) {
        reject(error);

        return;
      }
      if (!instance) {
        reject(new Error('openDatabase: Unable to get database instance'));

        return;
      }

      resolve(instance);
    };

    instance = new sql.Database(filePath, callback);

    // See: https://github.com/mapbox/node-sqlite3/issues/1395
    instance.serialize();
  });
}

type PromisifiedSQLDatabase = {
  close: () => Promise<void>;
  run: (statement: string, params?: { [key: string]: any }) => Promise<void>;
  get: (statement: string, params?: { [key: string]: any }) => Promise<any>;
  all: (
    statement: string,
    params?: { [key: string]: any }
  ) => Promise<Array<any>>;
  on: (event: 'trace', handler: (sql: string) => void) => void;
};

function promisify(rawInstance: sql.Database): PromisifiedSQLDatabase {
  return {
    close: pify(rawInstance.close.bind(rawInstance)),
    run: pify(rawInstance.run.bind(rawInstance)),
    get: pify(rawInstance.get.bind(rawInstance)),
    all: pify(rawInstance.all.bind(rawInstance)),
    on: rawInstance.on.bind(rawInstance),
  };
}

async function getSQLiteVersion(instance: PromisifiedSQLDatabase) {
  const row = await instance.get('select sqlite_version() AS sqlite_version');

  return row.sqlite_version;
}

async function getSchemaVersion(instance: PromisifiedSQLDatabase) {
  const row = await instance.get('PRAGMA schema_version;');

  return row.schema_version;
}

async function setUserVersion(
  instance: PromisifiedSQLDatabase,
  version: number
) {
  if (!isNumber(version)) {
    throw new Error(`setUserVersion: version ${version} is not a number`);
  }
  await instance.get(`PRAGMA user_version = ${version};`);
}
async function keyDatabase(instance: PromisifiedSQLDatabase, key: string) {
  // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
  await instance.run(`PRAGMA key = "x'${key}'";`);

  // https://sqlite.org/wal.html
  await instance.run('PRAGMA journal_mode = WAL;');
  await instance.run('PRAGMA synchronous = NORMAL;');
}
async function getUserVersion(instance: PromisifiedSQLDatabase) {
  const row = await instance.get('PRAGMA user_version;');

  return row.user_version;
}

async function getSQLCipherVersion(instance: PromisifiedSQLDatabase) {
  const row = await instance.get('PRAGMA cipher_version;');
  try {
    return row.cipher_version;
  } catch (e) {
    return null;
  }
}

async function getSQLCipherIntegrityCheck(instance: PromisifiedSQLDatabase) {
  const row = await instance.get('PRAGMA cipher_integrity_check;');
  if (row) {
    return row.cipher_integrity_check;
  }

  return null;
}

async function getSQLIntegrityCheck(instance: PromisifiedSQLDatabase) {
  const row = await instance.get('PRAGMA integrity_check;');
  if (row && row.integrity_check !== 'ok') {
    return row.integrity_check;
  }

  return null;
}

async function migrateSchemaVersion(instance: PromisifiedSQLDatabase) {
  const userVersion = await getUserVersion(instance);
  if (userVersion > 0) {
    return;
  }

  const schemaVersion = await getSchemaVersion(instance);
  const newUserVersion = schemaVersion > 18 ? 16 : schemaVersion;
  console.log(
    `migrateSchemaVersion: Migrating from schema_version ${schemaVersion} to user_version ${newUserVersion}`
  );

  await setUserVersion(instance, newUserVersion);
}

async function openAndMigrateDatabase(filePath: string, key: string) {
  let promisified: PromisifiedSQLDatabase | undefined;

  // First, we try to open the database without any cipher changes
  try {
    const instance = await openDatabase(filePath);
    promisified = promisify(instance);
    await keyDatabase(promisified, key);

    await migrateSchemaVersion(promisified);

    return promisified;
  } catch (error) {
    if (promisified) {
      await promisified.close();
    }
    console.log('migrateDatabase: Migration without cipher change failed');
  }

  // If that fails, we try to open the database with 3.x compatibility to extract the
  //   user_version (previously stored in schema_version, blown away by cipher_migrate).
  const instance1 = await openDatabase(filePath);
  promisified = promisify(instance1);
  await keyDatabase(promisified, key);

  // https://www.zetetic.net/blog/2018/11/30/sqlcipher-400-release/#compatability-sqlcipher-4-0-0
  await promisified.run('PRAGMA cipher_compatibility = 3;');
  await migrateSchemaVersion(promisified);
  await promisified.close();

  // After migrating user_version -> schema_version, we reopen database, because we can't
  //   migrate to the latest ciphers after we've modified the defaults.
  const instance2 = await openDatabase(filePath);
  promisified = promisify(instance2);
  await keyDatabase(promisified, key);

  await promisified.run('PRAGMA cipher_migrate;');

  return promisified;
}

const INVALID_KEY = /[^0-9A-Fa-f]/;
async function openAndSetUpSQLCipher(
  filePath: string,
  { key }: { key: string }
) {
  const match = INVALID_KEY.exec(key);
  if (match) {
    throw new Error(`setupSQLCipher: key '${key}' is not valid`);
  }

  const instance = await openAndMigrateDatabase(filePath, key);

  // Because foreign key support is not enabled by default!
  await instance.run('PRAGMA foreign_keys = ON;');

  return instance;
}

async function updateToSchemaVersion1(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 1) {
    return;
  }

  console.log('updateToSchemaVersion1: starting...');

  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(
      `CREATE TABLE messages(
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
    );`
    );

    await instance.run(`CREATE INDEX messages_unread ON messages (
      unread
    );`);
    await instance.run(`CREATE INDEX messages_expires_at ON messages (
      expires_at
    );`);
    await instance.run(`CREATE INDEX messages_receipt ON messages (
      sent_at
    );`);
    await instance.run(`CREATE INDEX messages_schemaVersion ON messages (
      schemaVersion
    );`);

    await instance.run(`CREATE INDEX messages_conversation ON messages (
      conversationId,
      received_at
    );`);

    await instance.run(`CREATE INDEX messages_duplicate_check ON messages (
      source,
      sourceDevice,
      sent_at
    );`);
    await instance.run(`CREATE INDEX messages_hasAttachments ON messages (
      conversationId,
      hasAttachments,
      received_at
    );`);
    await instance.run(`CREATE INDEX messages_hasFileAttachments ON messages (
      conversationId,
      hasFileAttachments,
      received_at
    );`);
    await instance.run(`CREATE INDEX messages_hasVisualMediaAttachments ON messages (
      conversationId,
      hasVisualMediaAttachments,
      received_at
    );`);

    await instance.run(`CREATE TABLE unprocessed(
      id STRING,
      timestamp INTEGER,
      json TEXT
    );`);
    await instance.run(`CREATE INDEX unprocessed_id ON unprocessed (
      id
    );`);
    await instance.run(`CREATE INDEX unprocessed_timestamp ON unprocessed (
      timestamp
    );`);

    await instance.run('PRAGMA user_version = 1;');
    await instance.run('COMMIT TRANSACTION;');

    console.log('updateToSchemaVersion1: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion2(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 2) {
    return;
  }

  console.log('updateToSchemaVersion2: starting...');

  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(
      `ALTER TABLE messages
     ADD COLUMN expireTimer INTEGER;`
    );

    await instance.run(
      `ALTER TABLE messages
     ADD COLUMN expirationStartTimestamp INTEGER;`
    );

    await instance.run(
      `ALTER TABLE messages
     ADD COLUMN type STRING;`
    );

    await instance.run(`CREATE INDEX messages_expiring ON messages (
      expireTimer,
      expirationStartTimestamp,
      expires_at
    );`);

    await instance.run(
      `UPDATE messages SET
      expirationStartTimestamp = json_extract(json, '$.expirationStartTimestamp'),
      expireTimer = json_extract(json, '$.expireTimer'),
      type = json_extract(json, '$.type');`
    );

    await instance.run('PRAGMA user_version = 2;');
    await instance.run('COMMIT TRANSACTION;');

    console.log('updateToSchemaVersion2: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion3(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 3) {
    return;
  }

  console.log('updateToSchemaVersion3: starting...');

  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run('DROP INDEX messages_expiring;');
    await instance.run('DROP INDEX messages_unread;');

    await instance.run(`CREATE INDEX messages_without_timer ON messages (
      expireTimer,
      expires_at,
      type
    ) WHERE expires_at IS NULL AND expireTimer IS NOT NULL;`);

    await instance.run(`CREATE INDEX messages_unread ON messages (
      conversationId,
      unread
    ) WHERE unread IS NOT NULL;`);

    await instance.run('ANALYZE;');
    await instance.run('PRAGMA user_version = 3;');
    await instance.run('COMMIT TRANSACTION;');

    console.log('updateToSchemaVersion3: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion4(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 4) {
    return;
  }

  console.log('updateToSchemaVersion4: starting...');

  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(
      `CREATE TABLE conversations(
      id STRING PRIMARY KEY ASC,
      json TEXT,

      active_at INTEGER,
      type STRING,
      members TEXT,
      name TEXT,
      profileName TEXT
    );`
    );

    await instance.run(`CREATE INDEX conversations_active ON conversations (
      active_at
    ) WHERE active_at IS NOT NULL;`);

    await instance.run(`CREATE INDEX conversations_type ON conversations (
      type
    ) WHERE type IS NOT NULL;`);

    await instance.run('PRAGMA user_version = 4;');
    await instance.run('COMMIT TRANSACTION;');

    console.log('updateToSchemaVersion4: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion6(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 6) {
    return;
  }
  console.log('updateToSchemaVersion6: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    // key-value, ids are strings, one extra column
    await instance.run(
      `CREATE TABLE sessions(
      id STRING PRIMARY KEY ASC,
      number STRING,
      json TEXT
    );`
    );

    await instance.run(`CREATE INDEX sessions_number ON sessions (
    number
  ) WHERE number IS NOT NULL;`);

    // key-value, ids are strings
    await instance.run(
      `CREATE TABLE groups(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );`
    );
    await instance.run(
      `CREATE TABLE identityKeys(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );`
    );
    await instance.run(
      `CREATE TABLE items(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );`
    );

    // key-value, ids are integers
    await instance.run(
      `CREATE TABLE preKeys(
      id INTEGER PRIMARY KEY ASC,
      json TEXT
    );`
    );
    await instance.run(
      `CREATE TABLE signedPreKeys(
      id INTEGER PRIMARY KEY ASC,
      json TEXT
    );`
    );

    await instance.run('PRAGMA user_version = 6;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion6: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion7(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 7) {
    return;
  }
  console.log('updateToSchemaVersion7: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    // SQLite has been coercing our STRINGs into numbers, so we force it with TEXT
    // We create a new table then copy the data into it, since we can't modify columns

    await instance.run('DROP INDEX sessions_number;');
    await instance.run('ALTER TABLE sessions RENAME TO sessions_old;');

    await instance.run(
      `CREATE TABLE sessions(
        id TEXT PRIMARY KEY,
        number TEXT,
        json TEXT
      );`
    );

    await instance.run(`CREATE INDEX sessions_number ON sessions (
      number
    ) WHERE number IS NOT NULL;`);

    await instance.run(`INSERT INTO sessions(id, number, json)
      SELECT "+" || id, number, json FROM sessions_old;
    `);

    await instance.run('DROP TABLE sessions_old;');

    await instance.run('PRAGMA user_version = 7;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion7: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion8(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 8) {
    return;
  }
  console.log('updateToSchemaVersion8: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    // First, we pull a new body field out of the message table's json blob
    await instance.run(
      `ALTER TABLE messages
     ADD COLUMN body TEXT;`
    );
    await instance.run(
      "UPDATE messages SET body = json_extract(json, '$.body')"
    );

    // Then we create our full-text search table and populate it
    await instance.run(`
      CREATE VIRTUAL TABLE messages_fts
      USING fts5(id UNINDEXED, body);
    `);
    await instance.run(`
      INSERT INTO messages_fts(id, body)
      SELECT id, body FROM messages;
    `);

    // Then we set up triggers to keep the full-text search table up to date
    await instance.run(`
      CREATE TRIGGER messages_on_insert AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts (
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;
    `);
    await instance.run(`
      CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
      END;
    `);
    await instance.run(`
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

    await instance.run('PRAGMA user_version = 8;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion8: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion9(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 9) {
    return;
  }
  console.log('updateToSchemaVersion9: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(`CREATE TABLE attachment_downloads(
      id STRING primary key,
      timestamp INTEGER,
      pending INTEGER,
      json TEXT
    );`);

    await instance.run(`CREATE INDEX attachment_downloads_timestamp
      ON attachment_downloads (
        timestamp
    ) WHERE pending = 0;`);
    await instance.run(`CREATE INDEX attachment_downloads_pending
      ON attachment_downloads (
        pending
    ) WHERE pending != 0;`);

    await instance.run('PRAGMA user_version = 9;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion9: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion10(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 10) {
    return;
  }
  console.log('updateToSchemaVersion10: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run('DROP INDEX unprocessed_id;');
    await instance.run('DROP INDEX unprocessed_timestamp;');
    await instance.run('ALTER TABLE unprocessed RENAME TO unprocessed_old;');

    await instance.run(`CREATE TABLE unprocessed(
      id STRING,
      timestamp INTEGER,
      version INTEGER,
      attempts INTEGER,
      envelope TEXT,
      decrypted TEXT,
      source TEXT,
      sourceDevice TEXT,
      serverTimestamp INTEGER
    );`);

    await instance.run(`CREATE INDEX unprocessed_id ON unprocessed (
      id
    );`);
    await instance.run(`CREATE INDEX unprocessed_timestamp ON unprocessed (
      timestamp
    );`);

    await instance.run(`INSERT INTO unprocessed (
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
    `);

    await instance.run('DROP TABLE unprocessed_old;');

    await instance.run('PRAGMA user_version = 10;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion10: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion11(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 11) {
    return;
  }
  console.log('updateToSchemaVersion11: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run('DROP TABLE groups;');

    await instance.run('PRAGMA user_version = 11;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion11: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion12(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 12) {
    return;
  }

  console.log('updateToSchemaVersion12: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(`CREATE TABLE sticker_packs(
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
    );`);

    await instance.run(`CREATE TABLE stickers(
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
    );`);

    await instance.run(`CREATE INDEX stickers_recents
      ON stickers (
        lastUsed
    ) WHERE lastUsed IS NOT NULL;`);

    await instance.run(`CREATE TABLE sticker_references(
      messageId STRING,
      packId TEXT,
      CONSTRAINT sticker_references_fk
        FOREIGN KEY(packId)
        REFERENCES sticker_packs(id)
        ON DELETE CASCADE
    );`);

    await instance.run('PRAGMA user_version = 12;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion12: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion13(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 13) {
    return;
  }

  console.log('updateToSchemaVersion13: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(
      'ALTER TABLE sticker_packs ADD COLUMN attemptedStatus STRING;'
    );

    await instance.run('PRAGMA user_version = 13;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion13: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion14(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 14) {
    return;
  }

  console.log('updateToSchemaVersion14: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(`CREATE TABLE emojis(
      shortName STRING PRIMARY KEY,
      lastUsage INTEGER
    );`);

    await instance.run(`CREATE INDEX emojis_lastUsage
      ON emojis (
        lastUsage
    );`);

    await instance.run('PRAGMA user_version = 14;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion14: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion15(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 15) {
    return;
  }

  console.log('updateToSchemaVersion15: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    // SQLite has again coerced our STRINGs into numbers, so we force it with TEXT
    // We create a new table then copy the data into it, since we can't modify columns

    await instance.run('DROP INDEX emojis_lastUsage;');
    await instance.run('ALTER TABLE emojis RENAME TO emojis_old;');

    await instance.run(`CREATE TABLE emojis(
      shortName TEXT PRIMARY KEY,
      lastUsage INTEGER
    );`);
    await instance.run(`CREATE INDEX emojis_lastUsage
      ON emojis (
        lastUsage
    );`);

    await instance.run('DELETE FROM emojis WHERE shortName = 1');
    await instance.run(`INSERT INTO emojis(shortName, lastUsage)
      SELECT shortName, lastUsage FROM emojis_old;
    `);

    await instance.run('DROP TABLE emojis_old;');

    await instance.run('PRAGMA user_version = 15;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion15: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion16(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 16) {
    return;
  }

  console.log('updateToSchemaVersion16: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(
      `ALTER TABLE messages
      ADD COLUMN messageTimer INTEGER;`
    );
    await instance.run(
      `ALTER TABLE messages
      ADD COLUMN messageTimerStart INTEGER;`
    );
    await instance.run(
      `ALTER TABLE messages
      ADD COLUMN messageTimerExpiresAt INTEGER;`
    );
    await instance.run(
      `ALTER TABLE messages
      ADD COLUMN isErased INTEGER;`
    );

    await instance.run(`CREATE INDEX messages_message_timer ON messages (
      messageTimer,
      messageTimerStart,
      messageTimerExpiresAt,
      isErased
    ) WHERE messageTimer IS NOT NULL;`);

    // Updating full-text triggers to avoid anything with a messageTimer set

    await instance.run('DROP TRIGGER messages_on_insert;');
    await instance.run('DROP TRIGGER messages_on_delete;');
    await instance.run('DROP TRIGGER messages_on_update;');

    await instance.run(`
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
    `);
    await instance.run(`
      CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
      END;
    `);
    await instance.run(`
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

    await instance.run('PRAGMA user_version = 16;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion16: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion17(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 17) {
    return;
  }

  console.log('updateToSchemaVersion17: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    try {
      await instance.run(
        `ALTER TABLE messages
        ADD COLUMN isViewOnce INTEGER;`
      );

      await instance.run('DROP INDEX messages_message_timer;');
    } catch (error) {
      console.log(
        'updateToSchemaVersion17: Message table already had isViewOnce column'
      );
    }

    try {
      await instance.run('DROP INDEX messages_view_once;');
    } catch (error) {
      console.log(
        'updateToSchemaVersion17: Index messages_view_once did not already exist'
      );
    }
    await instance.run(`CREATE INDEX messages_view_once ON messages (
      isErased
    ) WHERE isViewOnce = 1;`);

    // Updating full-text triggers to avoid anything with isViewOnce = 1

    await instance.run('DROP TRIGGER messages_on_insert;');
    await instance.run('DROP TRIGGER messages_on_update;');

    await instance.run(`
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
    `);
    await instance.run(`
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

    await instance.run('PRAGMA user_version = 17;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion17: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion18(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 18) {
    return;
  }

  console.log('updateToSchemaVersion18: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    // Delete and rebuild full-text search index to capture everything

    await instance.run('DELETE FROM messages_fts;');
    await instance.run(
      "INSERT INTO messages_fts(messages_fts) VALUES('rebuild');"
    );

    await instance.run(`
      INSERT INTO messages_fts(id, body)
      SELECT id, body FROM messages WHERE isViewOnce IS NULL OR isViewOnce != 1;
    `);

    // Fixing full-text triggers

    await instance.run('DROP TRIGGER messages_on_insert;');
    await instance.run('DROP TRIGGER messages_on_update;');

    await instance.run(`
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
    `);
    await instance.run(`
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

    await instance.run('PRAGMA user_version = 18;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion18: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion19(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 19) {
    return;
  }

  console.log('updateToSchemaVersion19: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await instance.run(
    `ALTER TABLE conversations
     ADD COLUMN profileFamilyName TEXT;`
  );
  await instance.run(
    `ALTER TABLE conversations
     ADD COLUMN profileFullName TEXT;`
  );

  // Preload new field with the profileName we already have
  await instance.run('UPDATE conversations SET profileFullName = profileName');

  try {
    await instance.run('PRAGMA user_version = 19;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion19: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion20(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 20) {
    return;
  }

  console.log('updateToSchemaVersion20: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    const migrationJobQueue = new PQueue({
      concurrency: 10,
      timeout: 1000 * 60 * 5,
      throwOnTimeout: true,
    });
    // The triggers on the messages table slow down this migration
    // significantly, so we drop them and recreate them later.
    // Drop triggers
    const triggers = await instance.all(
      'SELECT * FROM sqlite_master WHERE type = "trigger" AND tbl_name = "messages"'
    );

    for (const trigger of triggers) {
      await instance.run(`DROP TRIGGER ${trigger.name}`);
    }

    // Create new columns and indices
    await instance.run('ALTER TABLE conversations ADD COLUMN e164 TEXT;');
    await instance.run('ALTER TABLE conversations ADD COLUMN uuid TEXT;');
    await instance.run('ALTER TABLE conversations ADD COLUMN groupId TEXT;');
    await instance.run('ALTER TABLE messages ADD COLUMN sourceUuid TEXT;');
    await instance.run(
      'ALTER TABLE sessions RENAME COLUMN number TO conversationId;'
    );
    await instance.run(
      'CREATE INDEX conversations_e164 ON conversations(e164);'
    );
    await instance.run(
      'CREATE INDEX conversations_uuid ON conversations(uuid);'
    );
    await instance.run(
      'CREATE INDEX conversations_groupId ON conversations(groupId);'
    );
    await instance.run(
      'CREATE INDEX messages_sourceUuid on messages(sourceUuid);'
    );

    // Migrate existing IDs
    await instance.run(
      "UPDATE conversations SET e164 = '+' || id WHERE type = 'private';"
    );
    await instance.run(
      "UPDATE conversations SET groupId = id WHERE type = 'group';"
    );

    // Drop invalid groups and any associated messages
    const maybeInvalidGroups = await instance.all(
      "SELECT * FROM conversations WHERE type = 'group' AND members IS NULL;"
    );
    for (const group of maybeInvalidGroups) {
      const json = JSON.parse(group.json);
      if (!json.members || !json.members.length) {
        await instance.run('DELETE FROM conversations WHERE id = $id;', {
          $id: json.id,
        });
        await instance.run('DELETE FROM messages WHERE conversationId = $id;', {
          $id: json.id,
        });
        // await instance.run('DELETE FROM sessions WHERE conversationId = $id;', {
        //   $id: json.id,
        // });
      }
    }

    // Generate new IDs and alter data
    const allConversations = await instance.all('SELECT * FROM conversations;');
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

      await instance.run(
        'UPDATE conversations SET id = $newId, json = JSON_PATCH(json, $patch) WHERE id = $oldId',
        {
          $newId: newId,
          $oldId: oldId,
          $patch: patch,
        }
      );
      const messagePatch = JSON.stringify({ conversationId: newId });
      await instance.run(
        'UPDATE messages SET conversationId = $newId, json = JSON_PATCH(json, $patch) WHERE conversationId = $oldId',
        { $newId: newId, $oldId: oldId, $patch: messagePatch }
      );
    }

    const groupConverations = await instance.all(
      "SELECT * FROM conversations WHERE type = 'group';"
    );

    // Update group conversations, point members at new conversation ids
    migrationJobQueue.addAll(
      groupConverations.map(groupRow => async () => {
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
            await saveConversation(
              {
                id,
                e164: m,
                type: 'private',
                version: 2,
                unreadCount: 0,
                verified: 0,
              },
              instance
            );

            newMembers.push(id);
          }
        }
        const json = { ...jsonToObject(groupRow.json), members: newMembers };
        const newMembersValue = newMembers.join(' ');
        await instance.run(
          'UPDATE conversations SET members = $newMembersValue, json = $newJsonValue WHERE id = $id',
          {
            $id: groupRow.id,
            $newMembersValue: newMembersValue,
            $newJsonValue: objectToJSON(json),
          }
        );
      })
    );
    // Wait for group conversation updates to finish
    await migrationJobQueue.onEmpty();

    // Update sessions to stable IDs
    const allSessions = await instance.all('SELECT * FROM sessions;');
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
      await instance.run(
        `
        UPDATE sessions
        SET id = $newId, json = $newJson, conversationId = $newConversationId
        WHERE id = $oldId
      `,
        {
          $newId: newJson.id,
          $newJson: objectToJSON(newJson),
          $oldId: session.id,
          $newConversationId: newJson.conversationId,
        }
      );
    }

    // Update identity keys to stable IDs
    const allIdentityKeys = await instance.all('SELECT * FROM identityKeys;');
    for (const identityKey of allIdentityKeys) {
      const newJson = JSON.parse(identityKey.json);
      newJson.id = allConversationsByOldId[newJson.id];
      await instance.run(
        `
        UPDATE identityKeys
        SET id = $newId, json = $newJson
        WHERE id = $oldId
      `,
        {
          $newId: newJson.id,
          $newJson: objectToJSON(newJson),
          $oldId: identityKey.id,
        }
      );
    }

    // Recreate triggers
    for (const trigger of triggers) {
      await instance.run(trigger.sql);
    }

    await instance.run('PRAGMA user_version = 20;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion20: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion21(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 21) {
    return;
  }
  try {
    await instance.run('BEGIN TRANSACTION;');
    await instance.run(`
      UPDATE conversations
      SET json = json_set(
        json,
        '$.messageCount',
        (SELECT count(*) FROM messages WHERE messages.conversationId = conversations.id)
      );
    `);
    await instance.run(`
      UPDATE conversations
      SET json = json_set(
        json,
        '$.sentMessageCount',
        (SELECT count(*) FROM messages WHERE messages.conversationId = conversations.id AND messages.type = 'outgoing')
      );
    `);
    await instance.run('PRAGMA user_version = 21;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion21: success!');
  } catch (error) {
    await instance.run('ROLLBACK');
    throw error;
  }
}

async function updateToSchemaVersion22(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 22) {
    return;
  }
  try {
    await instance.run('BEGIN TRANSACTION;');
    await instance.run(
      `ALTER TABLE unprocessed
     ADD COLUMN sourceUuid STRING;`
    );

    await instance.run('PRAGMA user_version = 22;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion22: success!');
  } catch (error) {
    await instance.run('ROLLBACK');
    throw error;
  }
}

async function updateToSchemaVersion23(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 23) {
    return;
  }
  try {
    await instance.run('BEGIN TRANSACTION;');

    // Remove triggers which keep full-text search up to date
    await instance.run('DROP TRIGGER messages_on_insert;');
    await instance.run('DROP TRIGGER messages_on_update;');
    await instance.run('DROP TRIGGER messages_on_delete;');

    await instance.run('PRAGMA user_version = 23;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion23: success!');
  } catch (error) {
    await instance.run('ROLLBACK');
    throw error;
  }
}

async function updateToSchemaVersion24(
  currentVersion: number,
  instance: PromisifiedSQLDatabase
) {
  if (currentVersion >= 24) {
    return;
  }

  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(`
      ALTER TABLE conversations
      ADD COLUMN profileLastFetchedAt INTEGER;
    `);

    await instance.run('PRAGMA user_version = 24;');
    await instance.run('COMMIT TRANSACTION;');

    console.log('updateToSchemaVersion24: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

const SCHEMA_VERSIONS = [
  updateToSchemaVersion1,
  updateToSchemaVersion2,
  updateToSchemaVersion3,
  updateToSchemaVersion4,
  (_v: number, _i: PromisifiedSQLDatabase) => null, // version 5 was dropped
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
];

async function updateSchema(instance: PromisifiedSQLDatabase) {
  const sqliteVersion = await getSQLiteVersion(instance);
  const sqlcipherVersion = await getSQLCipherVersion(instance);
  const userVersion = await getUserVersion(instance);
  const maxUserVersion = SCHEMA_VERSIONS.length;
  const schemaVersion = await getSchemaVersion(instance);

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

    // Yes, we really want to do this asynchronously, in order
    await runSchemaUpdate(userVersion, instance);
  }
}

let globalInstance: PromisifiedSQLDatabase | undefined;
let globalInstanceRenderer: PromisifiedSQLDatabase | undefined;
let databaseFilePath: string | undefined;
let indexedDBPath: string | undefined;

async function initialize({
  configDir,
  key,
  messages,
}: {
  configDir: string;
  key: string;
  messages: LocaleMessagesType;
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
  if (!isObject(messages)) {
    throw new Error('initialize: message is required!');
  }

  indexedDBPath = join(configDir, 'IndexedDB');

  const dbDir = join(configDir, 'sql');
  mkdirp.sync(dbDir);

  databaseFilePath = join(dbDir, 'db.sqlite');

  let promisified: PromisifiedSQLDatabase | undefined;

  try {
    promisified = await openAndSetUpSQLCipher(databaseFilePath, { key });

    // if (promisified) {
    //   promisified.on('trace', async statement => {
    //     if (
    //       !globalInstance ||
    //       statement.startsWith('--') ||
    //       statement.includes('COMMIT') ||
    //       statement.includes('BEGIN') ||
    //       statement.includes('ROLLBACK')
    //     ) {
    //       return;
    //     }

    //     // Note that this causes problems when attempting to commit transactions - this
    //     //   statement is running, and we get at SQLITE_BUSY error. So we delay.
    //     await new Promise(resolve => setTimeout(resolve, 1000));

    //     const data = await promisified.get(`EXPLAIN QUERY PLAN ${statement}`);
    //     console._log(`EXPLAIN QUERY PLAN ${statement}\n`, data && data.detail);
    //   });
    // }

    await updateSchema(promisified);

    // test database

    const cipherIntegrityResult = await getSQLCipherIntegrityCheck(promisified);
    if (cipherIntegrityResult) {
      console.log(
        'Database cipher integrity check failed:',
        cipherIntegrityResult
      );
      throw new Error(
        `Cipher integrity check failed: ${cipherIntegrityResult}`
      );
    }
    const integrityResult = await getSQLIntegrityCheck(promisified);
    if (integrityResult) {
      console.log('Database integrity check failed:', integrityResult);
      throw new Error(`Integrity check failed: ${integrityResult}`);
    }

    // At this point we can allow general access to the database
    globalInstance = promisified;

    // test database
    await getMessageCount();
  } catch (error) {
    console.log('Database startup error:', error.stack);
    if (promisified) {
      await promisified.close();
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

  let promisified: PromisifiedSQLDatabase | undefined;

  try {
    promisified = await openAndSetUpSQLCipher(databaseFilePath, { key });

    // At this point we can allow general access to the database
    globalInstanceRenderer = promisified;

    // test database
    await getMessageCount();
  } catch (error) {
    window.log.error('Database startup error:', error.stack);
    throw error;
  }
}

async function close() {
  if (!globalInstance) {
    return;
  }

  const dbRef = globalInstance;
  globalInstance = undefined;
  await dbRef.close();
}

async function removeDB() {
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

async function removeIndexedDBFiles() {
  if (!indexedDBPath) {
    throw new Error(
      'removeIndexedDBFiles: Need to initialize and set indexedDBPath first!'
    );
  }

  const pattern = join(indexedDBPath, '*.leveldb');
  rimraf.sync(pattern);
  indexedDBPath = undefined;
}

function getInstance(): PromisifiedSQLDatabase {
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
async function createOrUpdateIdentityKey(data: IdentityKeyType) {
  return createOrUpdate(IDENTITY_KEYS_TABLE, data);
}
async function getIdentityKeyById(id: string) {
  return getById(IDENTITY_KEYS_TABLE, id);
}
async function bulkAddIdentityKeys(array: Array<IdentityKeyType>) {
  return bulkAdd(IDENTITY_KEYS_TABLE, array);
}
bulkAddIdentityKeys.needsSerial = true;
async function removeIdentityKeyById(id: string) {
  return removeById(IDENTITY_KEYS_TABLE, id);
}
async function removeAllIdentityKeys() {
  return removeAllFromTable(IDENTITY_KEYS_TABLE);
}
async function getAllIdentityKeys() {
  return getAllFromTable(IDENTITY_KEYS_TABLE);
}

const PRE_KEYS_TABLE = 'preKeys';
async function createOrUpdatePreKey(data: PreKeyType) {
  return createOrUpdate(PRE_KEYS_TABLE, data);
}
async function getPreKeyById(id: number) {
  return getById(PRE_KEYS_TABLE, id);
}
async function bulkAddPreKeys(array: Array<PreKeyType>) {
  return bulkAdd(PRE_KEYS_TABLE, array);
}
bulkAddPreKeys.needsSerial = true;
async function removePreKeyById(id: number) {
  return removeById(PRE_KEYS_TABLE, id);
}
async function removeAllPreKeys() {
  return removeAllFromTable(PRE_KEYS_TABLE);
}
async function getAllPreKeys() {
  return getAllFromTable(PRE_KEYS_TABLE);
}

const SIGNED_PRE_KEYS_TABLE = 'signedPreKeys';
async function createOrUpdateSignedPreKey(data: SignedPreKeyType) {
  return createOrUpdate(SIGNED_PRE_KEYS_TABLE, data);
}
async function getSignedPreKeyById(id: number) {
  return getById(SIGNED_PRE_KEYS_TABLE, id);
}
async function bulkAddSignedPreKeys(array: Array<SignedPreKeyType>) {
  return bulkAdd(SIGNED_PRE_KEYS_TABLE, array);
}
bulkAddSignedPreKeys.needsSerial = true;
async function removeSignedPreKeyById(id: number) {
  return removeById(SIGNED_PRE_KEYS_TABLE, id);
}
async function removeAllSignedPreKeys() {
  return removeAllFromTable(SIGNED_PRE_KEYS_TABLE);
}
async function getAllSignedPreKeys() {
  const db = getInstance();
  const rows = await db.all('SELECT json FROM signedPreKeys ORDER BY id ASC;');

  return map(rows, row => jsonToObject(row.json));
}

const ITEMS_TABLE = 'items';
async function createOrUpdateItem(data: ItemType) {
  return createOrUpdate(ITEMS_TABLE, data);
}
async function getItemById(id: string) {
  return getById(ITEMS_TABLE, id);
}
async function getAllItems() {
  const db = getInstance();
  const rows = await db.all('SELECT json FROM items ORDER BY id ASC;');

  return map(rows, row => jsonToObject(row.json));
}
async function bulkAddItems(array: Array<ItemType>) {
  return bulkAdd(ITEMS_TABLE, array);
}
bulkAddItems.needsSerial = true;
async function removeItemById(id: string) {
  return removeById(ITEMS_TABLE, id);
}
async function removeAllItems() {
  return removeAllFromTable(ITEMS_TABLE);
}

const SESSIONS_TABLE = 'sessions';
async function createOrUpdateSession(data: SessionType) {
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

  await db.run(
    `INSERT OR REPLACE INTO sessions (
      id,
      conversationId,
      json
    ) values (
      $id,
      $conversationId,
      $json
    )`,
    {
      $id: id,
      $conversationId: conversationId,
      $json: objectToJSON(data),
    }
  );
}
async function createOrUpdateSessions(array: Array<SessionType>) {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      ...map(array, async item => createOrUpdateSession(item)),
    ]);
    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
createOrUpdateSessions.needsSerial = true;

async function getSessionById(id: string) {
  return getById(SESSIONS_TABLE, id);
}
async function getSessionsById(conversationId: string) {
  const db = getInstance();
  const rows = await db.all(
    'SELECT * FROM sessions WHERE conversationId = $conversationId;',
    {
      $conversationId: conversationId,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}
async function bulkAddSessions(array: Array<SessionType>) {
  return bulkAdd(SESSIONS_TABLE, array);
}
bulkAddSessions.needsSerial = true;
async function removeSessionById(id: string) {
  return removeById(SESSIONS_TABLE, id);
}
async function removeSessionsByConversation(conversationId: string) {
  const db = getInstance();
  await db.run('DELETE FROM sessions WHERE conversationId = $conversationId;', {
    $conversationId: conversationId,
  });
}
async function removeAllSessions() {
  return removeAllFromTable(SESSIONS_TABLE);
}
async function getAllSessions() {
  return getAllFromTable(SESSIONS_TABLE);
}

async function createOrUpdate(table: string, data: any) {
  const db = getInstance();
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdate: Provided data did not have a truthy id');
  }

  await db.run(
    `INSERT OR REPLACE INTO ${table} (
      id,
      json
    ) values (
      $id,
      $json
    )`,
    {
      $id: id,
      $json: objectToJSON(data),
    }
  );
}

async function bulkAdd(table: string, array: Array<any>) {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      ...map(array, async data => createOrUpdate(table, data)),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
bulkAdd.needsSerial = true;

async function getById(table: string, id: string | number) {
  const db = getInstance();
  const row = await db.get(`SELECT * FROM ${table} WHERE id = $id;`, {
    $id: id,
  });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}

async function removeById(table: string, id: string | number) {
  const db = getInstance();
  if (!Array.isArray(id)) {
    await db.run(`DELETE FROM ${table} WHERE id = $id;`, { $id: id });

    return;
  }

  if (!id.length) {
    throw new Error('removeById: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM ${table} WHERE id IN ( ${id.map(() => '?').join(', ')} );`,
    id
  );
}

async function removeAllFromTable(table: string) {
  const db = getInstance();
  await db.run(`DELETE FROM ${table};`);
}

async function getAllFromTable(table: string) {
  const db = getInstance();
  const rows = await db.all(`SELECT json FROM ${table};`);

  return rows.map(row => jsonToObject(row.json));
}

// Conversations

async function getConversationCount() {
  const db = getInstance();
  const row = await db.get('SELECT count(*) from conversations;');

  if (!row) {
    throw new Error(
      'getConversationCount: Unable to get count of conversations'
    );
  }

  return row['count(*)'];
}

async function saveConversation(
  data: ConversationType,
  instance = getInstance()
) {
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

  await instance.run(
    `INSERT INTO conversations (
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
  );`,
    {
      $id: id,
      $json: objectToJSON(omit(data, ['profileLastFetchedAt'])),

      $e164: e164,
      $uuid: uuid,
      $groupId: groupId,

      $active_at: active_at,
      $type: type,
      $members: membersList,
      $name: name,
      $profileName: profileName,
      $profileFamilyName: profileFamilyName,
      $profileFullName: combineNames(profileName, profileFamilyName),
      $profileLastFetchedAt: profileLastFetchedAt,
    }
  );
}

async function saveConversations(
  arrayOfConversations: Array<ConversationType>
) {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      ...map(arrayOfConversations, async conversation =>
        saveConversation(conversation)
      ),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
saveConversations.needsSerial = true;

async function updateConversation(data: ConversationType) {
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

  await db.run(
    `UPDATE conversations SET
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
    WHERE id = $id;`,
    {
      $id: id,
      $json: objectToJSON(omit(data, ['profileLastFetchedAt'])),

      $e164: e164,
      $uuid: uuid,

      $active_at: active_at,
      $type: type,
      $members: membersList,
      $name: name,
      $profileName: profileName,
      $profileFamilyName: profileFamilyName,
      $profileFullName: combineNames(profileName, profileFamilyName),
      $profileLastFetchedAt: profileLastFetchedAt,
    }
  );
}

async function updateConversations(array: Array<ConversationType>) {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([...map(array, async item => updateConversation(item))]);
    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
updateConversations.needsSerial = true;

async function removeConversation(id: Array<string> | string) {
  const db = getInstance();
  if (!Array.isArray(id)) {
    await db.run('DELETE FROM conversations WHERE id = $id;', { $id: id });

    return;
  }

  if (!id.length) {
    throw new Error('removeConversation: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM conversations WHERE id IN ( ${id
      .map(() => '?')
      .join(', ')} );`,
    id
  );
}

async function getConversationById(id: string) {
  const db = getInstance();
  const row = await db.get('SELECT * FROM conversations WHERE id = $id;', {
    $id: id,
  });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function eraseStorageServiceStateFromConversations() {
  const db = getInstance();

  await db.run(
    `UPDATE conversations SET
      json = json_remove(json, '$.storageID', '$.needsStorageServiceSync', '$.unknownFields', '$.storageProfileKey');
    `
  );
}

async function getAllConversations() {
  const db = getInstance();
  const rows = await db.all(`
    SELECT json, profileLastFetchedAt
    FROM conversations
    ORDER BY id ASC;
  `);

  return map(rows, row => rowToConversation(row));
}

async function getAllConversationIds() {
  const db = getInstance();
  const rows = await db.all('SELECT id FROM conversations ORDER BY id ASC;');

  return map(rows, row => row.id);
}

async function getAllPrivateConversations() {
  const db = getInstance();
  const rows = await db.all(
    `SELECT json, profileLastFetchedAt
    FROM conversations
    WHERE type = 'private'
    ORDER BY id ASC;`
  );

  return map(rows, row => rowToConversation(row));
}

async function getAllGroupsInvolvingId(id: string) {
  const db = getInstance();
  const rows = await db.all(
    `SELECT json, profileLastFetchedAt
     FROM conversations WHERE
      type = 'group' AND
      members LIKE $id
     ORDER BY id ASC;`,
    {
      $id: `%${id}%`,
    }
  );

  return map(rows, row => rowToConversation(row));
}

async function searchConversations(
  query: string,
  { limit }: { limit?: number } = {}
): Promise<Array<ConversationType>> {
  const db = getInstance();
  const rows = await db.all(
    `SELECT json, profileLastFetchedAt
     FROM conversations WHERE
      (
        e164 LIKE $query OR
        name LIKE $query OR
        profileFullName LIKE $query
      )
     ORDER BY active_at DESC
     LIMIT $limit`,
    {
      $query: `%${query}%`,
      $limit: limit || 100,
    }
  );

  return map(rows, row => rowToConversation(row));
}

async function searchMessages(
  query: string,
  { limit }: { limit?: number } = {}
): Promise<Array<SearchResultMessageType>> {
  const db = getInstance();
  const rows = await db.all(
    `SELECT
      messages.json,
      snippet(messages_fts, -1, '<<left>>', '<<right>>', '...', 10) as snippet
    FROM messages_fts
    INNER JOIN messages on messages_fts.id = messages.id
    WHERE
      messages_fts match $query
    ORDER BY messages.received_at DESC, messages.sent_at DESC
    LIMIT $limit;`,
    {
      $query: query,
      $limit: limit || 500,
    }
  );

  return map(rows, row => ({
    json: row.json,
    snippet: row.snippet,
  }));
}

async function searchMessagesInConversation(
  query: string,
  conversationId: string,
  { limit }: { limit?: number } = {}
): Promise<Array<SearchResultMessageType>> {
  const db = getInstance();
  const rows = await db.all(
    `SELECT
      messages.json,
      snippet(messages_fts, -1, '<<left>>', '<<right>>', '...', 10) as snippet
    FROM messages_fts
    INNER JOIN messages on messages_fts.id = messages.id
    WHERE
      messages_fts match $query AND
      messages.conversationId = $conversationId
    ORDER BY messages.received_at DESC, messages.sent_at DESC
    LIMIT $limit;`,
    {
      $query: query,
      $conversationId: conversationId,
      $limit: limit || 100,
    }
  );

  return map(rows, row => ({
    json: row.json,
    snippet: row.snippet,
  }));
}

async function getMessageCount(conversationId?: string) {
  const db = getInstance();
  const row = conversationId
    ? await db.get(
        'SELECT count(*) from messages WHERE conversationId = $conversationId;',
        { $conversationId: conversationId }
      )
    : await db.get('SELECT count(*) from messages;');

  if (!row) {
    throw new Error('getMessageCount: Unable to get count of messages');
  }

  return row['count(*)'];
}

async function saveMessage(
  data: MessageType,
  {
    forceSave,
    alreadyInTransaction,
  }: { forceSave?: boolean; alreadyInTransaction?: boolean } = {}
) {
  const db = getInstance();
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
    $id: id,
    $json: objectToJSON(data),

    $body: body,
    $conversationId: conversationId,
    $expirationStartTimestamp: expirationStartTimestamp,
    $expires_at: expires_at,
    $expireTimer: expireTimer,
    $hasAttachments: hasAttachments,
    $hasFileAttachments: hasFileAttachments,
    $hasVisualMediaAttachments: hasVisualMediaAttachments,
    $isErased: isErased,
    $isViewOnce: isViewOnce,
    $received_at: received_at,
    $schemaVersion: schemaVersion,
    $sent_at: sent_at,
    $source: source,
    $sourceUuid: sourceUuid,
    $sourceDevice: sourceDevice,
    $type: type,
    $unread: unread,
  };

  if (id && !forceSave) {
    if (!alreadyInTransaction) {
      await db.run('BEGIN TRANSACTION;');
    }

    try {
      await Promise.all([
        db.run(
          `UPDATE messages SET
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
          WHERE id = $id;`,
          payload
        ),
        db.run('DELETE FROM messages_fts WHERE id = $id;', {
          $id: id,
        }),
      ]);

      if (body) {
        await db.run(
          `INSERT INTO messages_fts(
             id,
             body
           ) VALUES (
             $id,
             $body
           );
          `,
          {
            $id: id,
            $body: body,
          }
        );
      }

      if (!alreadyInTransaction) {
        await db.run('COMMIT TRANSACTION;');
      }
    } catch (error) {
      if (!alreadyInTransaction) {
        await db.run('ROLLBACK;');
      }
      throw error;
    }

    return id;
  }

  const toCreate = {
    ...data,
    id: id || generateUUID(),
  };

  if (!alreadyInTransaction) {
    await db.run('BEGIN TRANSACTION;');
  }

  try {
    await db.run('DELETE FROM messages_fts WHERE id = $id;', {
      $id: id,
    });

    await Promise.all([
      db.run(
        `INSERT INTO messages (
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
        );`,
        {
          ...payload,
          $id: toCreate.id,
          $json: objectToJSON(toCreate),
        }
      ),
      db.run(
        `INSERT INTO messages_fts(
           id,
           body
         ) VALUES (
           $id,
           $body
         );
        `,
        {
          $id: id,
          $body: body,
        }
      ),
    ]);

    if (!alreadyInTransaction) {
      await db.run('COMMIT TRANSACTION;');
    }
  } catch (error) {
    if (!alreadyInTransaction) {
      await db.run('ROLLBACK;');
    }
    throw error;
  }

  return toCreate.id;
}
saveMessage.needsSerial = true;

async function saveMessages(
  arrayOfMessages: Array<MessageType>,
  { forceSave }: { forceSave?: boolean } = {}
) {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      ...map(arrayOfMessages, async message =>
        saveMessage(message, { forceSave, alreadyInTransaction: true })
      ),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
saveMessages.needsSerial = true;

async function removeMessage(id: string) {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      db.run('DELETE FROM messages WHERE id = $id;', { $id: id }),
      db.run('DELETE FROM messages_fts WHERE id = $id;', { $id: id }),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
removeMessage.needsSerial = true;

async function removeMessages(ids: Array<string>) {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      db.run(
        `DELETE FROM messages WHERE id IN ( ${ids
          .map(() => '?')
          .join(', ')} );`,
        ids
      ),
      db.run(
        `DELETE FROM messages_fts WHERE id IN ( ${ids
          .map(() => '?')
          .join(', ')} );`,
        ids
      ),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
removeMessages.needsSerial = true;

async function getMessageById(id: string) {
  const db = getInstance();
  const row = await db.get('SELECT * FROM messages WHERE id = $id;', {
    $id: id,
  });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function _getAllMessages() {
  const db = getInstance();
  const rows = await db.all('SELECT json FROM messages ORDER BY id ASC;');

  return map(rows, row => jsonToObject(row.json));
}

async function getAllMessageIds() {
  const db = getInstance();
  const rows = await db.all('SELECT id FROM messages ORDER BY id ASC;');

  return map(rows, row => row.id);
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
}) {
  const db = getInstance();
  const rows = await db.all(
    `SELECT json FROM messages WHERE
      (source = $source OR sourceUuid = $sourceUuid) AND
      sourceDevice = $sourceDevice AND
      sent_at = $sent_at;`,
    {
      $source: source,
      $sourceUuid: sourceUuid,
      $sourceDevice: sourceDevice,
      $sent_at: sent_at,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getUnreadByConversation(conversationId: string) {
  const db = getInstance();
  const rows = await db.all(
    `SELECT json FROM messages WHERE
      unread = $unread AND
      conversationId = $conversationId
     ORDER BY received_at DESC, sent_at DESC;`,
    {
      $unread: 1,
      $conversationId: conversationId,
    }
  );

  return map(rows, row => jsonToObject(row.json));
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
) {
  const db = getInstance();
  let rows;

  if (messageId) {
    rows = await db.all(
      `SELECT json FROM messages WHERE
       conversationId = $conversationId AND
       id != $messageId AND
       (
         (received_at = $received_at AND sent_at < $sent_at) OR
         received_at < $received_at
       )
     ORDER BY received_at DESC, sent_at DESC
     LIMIT $limit;`,
      {
        $conversationId: conversationId,
        $received_at: receivedAt,
        $sent_at: sentAt,
        $limit: limit,
        $messageId: messageId,
      }
    );
  } else {
    rows = await db.all(
      `SELECT json FROM messages WHERE
       conversationId = $conversationId AND
       (
         (received_at = $received_at AND sent_at < $sent_at) OR
         received_at < $received_at
       )
     ORDER BY received_at DESC, sent_at DESC
     LIMIT $limit;`,
      {
        $conversationId: conversationId,
        $received_at: receivedAt,
        $sent_at: sentAt,
        $limit: limit,
      }
    );
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
) {
  const db = getInstance();
  const rows = await db.all(
    `SELECT json FROM messages WHERE
       conversationId = $conversationId AND
       (
         (received_at = $received_at AND sent_at > $sent_at) OR
         received_at > $received_at
       )
     ORDER BY received_at ASC, sent_at ASC
     LIMIT $limit;`,
    {
      $conversationId: conversationId,
      $received_at: receivedAt,
      $sent_at: sentAt,
      $limit: limit,
    }
  );

  return rows;
}
async function getOldestMessageForConversation(conversationId: string) {
  const db = getInstance();
  const row = await db.get(
    `SELECT * FROM messages WHERE
       conversationId = $conversationId
     ORDER BY received_at ASC, sent_at ASC
     LIMIT 1;`,
    {
      $conversationId: conversationId,
    }
  );

  if (!row) {
    return null;
  }

  return row;
}
async function getNewestMessageForConversation(conversationId: string) {
  const db = getInstance();
  const row = await db.get(
    `SELECT * FROM messages WHERE
       conversationId = $conversationId
     ORDER BY received_at DESC, sent_at DESC
     LIMIT 1;`,
    {
      $conversationId: conversationId,
    }
  );

  if (!row) {
    return null;
  }

  return row;
}

async function getLastConversationActivity({
  conversationId,
  ourConversationId,
}: {
  conversationId: string;
  ourConversationId: string;
}): Promise<MessageType | null> {
  const db = getInstance();
  const row = await db.get(
    `SELECT * FROM messages WHERE
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
     LIMIT 1;`,
    {
      $conversationId: conversationId,
      $ourConversationId: ourConversationId,
    }
  );

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}
async function getLastConversationPreview({
  conversationId,
  ourConversationId,
}: {
  conversationId: string;
  ourConversationId: string;
}): Promise<MessageType | null> {
  const db = getInstance();
  const row = await db.get(
    `SELECT * FROM messages WHERE
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
     LIMIT 1;`,
    {
      $conversationId: conversationId,
      $ourConversationId: ourConversationId,
    }
  );

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}
async function getOldestUnreadMessageForConversation(conversationId: string) {
  const db = getInstance();
  const row = await db.get(
    `SELECT * FROM messages WHERE
       conversationId = $conversationId AND
       unread = 1
     ORDER BY received_at ASC, sent_at ASC
     LIMIT 1;`,
    {
      $conversationId: conversationId,
    }
  );

  if (!row) {
    return null;
  }

  return row;
}

async function getTotalUnreadForConversation(conversationId: string) {
  const db = getInstance();
  const row = await db.get(
    `SELECT count(id) from messages WHERE
       conversationId = $conversationId AND
       unread = 1;
    `,
    {
      $conversationId: conversationId,
    }
  );

  if (!row) {
    throw new Error('getTotalUnreadForConversation: Unable to get count');
  }

  return row['count(id)'];
}

async function getMessageMetricsForConversation(conversationId: string) {
  const results = await Promise.all([
    getOldestMessageForConversation(conversationId),
    getNewestMessageForConversation(conversationId),
    getOldestUnreadMessageForConversation(conversationId),
    getTotalUnreadForConversation(conversationId),
  ]);

  const [oldest, newest, oldestUnread, totalUnread] = results;

  return {
    oldest: oldest ? pick(oldest, ['received_at', 'sent_at', 'id']) : null,
    newest: newest ? pick(newest, ['received_at', 'sent_at', 'id']) : null,
    oldestUnread: oldestUnread
      ? pick(oldestUnread, ['received_at', 'sent_at', 'id'])
      : null,
    totalUnread,
  };
}
getMessageMetricsForConversation.needsSerial = true;

async function hasGroupCallHistoryMessage(
  conversationId: string,
  eraId: string
): Promise<boolean> {
  const db = getInstance();

  const row: unknown = await db.get(
    `
    SELECT count(*) FROM messages
    WHERE conversationId = $conversationId
    AND type = 'call-history'
    AND json_extract(json, '$.callHistoryDetails.callMode') = 'Group'
    AND json_extract(json, '$.callHistoryDetails.eraId') = $eraId
    LIMIT 1;
    `,
    {
      $conversationId: conversationId,
      $eraId: eraId,
    }
  );

  if (typeof row === 'object' && row && !Array.isArray(row)) {
    const count = Number((row as Record<string, unknown>)['count(*)']);
    return Boolean(count);
  }
  return false;
}

async function migrateConversationMessages(
  obsoleteId: string,
  currentId: string
) {
  const db = getInstance();

  await db.run(
    `UPDATE messages SET
      conversationId = $currentId,
      json = json_set(json, '$.conversationId', $currentId)
     WHERE conversationId = $obsoleteId;`,
    {
      $obsoleteId: obsoleteId,
      $currentId: currentId,
    }
  );
}
migrateConversationMessages.needsSerial = true;

async function getMessagesBySentAt(sentAt: number) {
  const db = getInstance();
  const rows = await db.all(
    `SELECT * FROM messages
     WHERE sent_at = $sent_at
     ORDER BY received_at DESC, sent_at DESC;`,
    {
      $sent_at: sentAt,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getExpiredMessages() {
  const db = getInstance();
  const now = Date.now();

  const rows = await db.all(
    `SELECT json FROM messages WHERE
      expires_at IS NOT NULL AND
      expires_at <= $expires_at
     ORDER BY expires_at ASC;`,
    {
      $expires_at: now,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getOutgoingWithoutExpiresAt() {
  const db = getInstance();
  const rows = await db.all(`
    SELECT json FROM messages
    INDEXED BY messages_without_timer
    WHERE
      expireTimer > 0 AND
      expires_at IS NULL AND
      type IS 'outgoing'
    ORDER BY expires_at ASC;
  `);

  return map(rows, row => jsonToObject(row.json));
}

async function getNextExpiringMessage() {
  const db = getInstance();

  // Note: we avoid 'IS NOT NULL' here because it does seem to bypass our index
  const rows = await db.all(`
    SELECT json FROM messages
    WHERE expires_at > 0
    ORDER BY expires_at ASC
    LIMIT 1;
  `);

  if (!rows || rows.length < 1) {
    return null;
  }

  return jsonToObject(rows[0].json);
}

async function getNextTapToViewMessageToAgeOut() {
  const db = getInstance();
  const rows = await db.all(`
    SELECT json FROM messages
    WHERE
      isViewOnce = 1
      AND (isErased IS NULL OR isErased != 1)
    ORDER BY received_at ASC, sent_at ASC
    LIMIT 1;
  `);

  if (!rows || rows.length < 1) {
    return null;
  }

  return jsonToObject(rows[0].json);
}

async function getTapToViewMessagesNeedingErase() {
  const db = getInstance();
  const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const rows = await db.all(
    `SELECT json FROM messages
    WHERE
      isViewOnce = 1
      AND (isErased IS NULL OR isErased != 1)
      AND received_at <= $THIRTY_DAYS_AGO
    ORDER BY received_at ASC, sent_at ASC;`,
    {
      $THIRTY_DAYS_AGO: THIRTY_DAYS_AGO,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function saveUnprocessed(
  data: UnprocessedType,
  { forceSave }: { forceSave?: boolean } = {}
) {
  const db = getInstance();
  const { id, timestamp, version, attempts, envelope } = data;
  if (!id) {
    throw new Error('saveUnprocessed: id was falsey');
  }

  if (forceSave) {
    await db.run(
      `INSERT INTO unprocessed (
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
      );`,
      {
        $id: id,
        $timestamp: timestamp,
        $version: version,
        $attempts: attempts,
        $envelope: envelope,
      }
    );

    return id;
  }

  await db.run(
    `UPDATE unprocessed SET
      timestamp = $timestamp,
      version = $version,
      attempts = $attempts,
      envelope = $envelope
    WHERE id = $id;`,
    {
      $id: id,
      $timestamp: timestamp,
      $version: version,
      $attempts: attempts,
      $envelope: envelope,
    }
  );

  return id;
}

async function saveUnprocesseds(
  arrayOfUnprocessed: Array<UnprocessedType>,
  { forceSave }: { forceSave?: boolean } = {}
) {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      ...map(arrayOfUnprocessed, async unprocessed =>
        saveUnprocessed(unprocessed, { forceSave })
      ),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
saveUnprocesseds.needsSerial = true;

async function updateUnprocessedAttempts(id: string, attempts: number) {
  const db = getInstance();
  await db.run('UPDATE unprocessed SET attempts = $attempts WHERE id = $id;', {
    $id: id,
    $attempts: attempts,
  });
}
async function updateUnprocessedWithData(id: string, data: UnprocessedType) {
  const db = getInstance();
  const { source, sourceUuid, sourceDevice, serverTimestamp, decrypted } = data;

  await db.run(
    `UPDATE unprocessed SET
      source = $source,
      sourceUuid = $sourceUuid,
      sourceDevice = $sourceDevice,
      serverTimestamp = $serverTimestamp,
      decrypted = $decrypted
    WHERE id = $id;`,
    {
      $id: id,
      $source: source,
      $sourceUuid: sourceUuid,
      $sourceDevice: sourceDevice,
      $serverTimestamp: serverTimestamp,
      $decrypted: decrypted,
    }
  );
}
async function updateUnprocessedsWithData(
  arrayOfUnprocessed: Array<UnprocessedType>
) {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      ...map(arrayOfUnprocessed, async ({ id, data }) =>
        updateUnprocessedWithData(id, data)
      ),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
updateUnprocessedsWithData.needsSerial = true;

async function getUnprocessedById(id: string) {
  const db = getInstance();
  const row = await db.get('SELECT * FROM unprocessed WHERE id = $id;', {
    $id: id,
  });

  return row;
}

async function getUnprocessedCount() {
  const db = getInstance();
  const row = await db.get('SELECT count(*) from unprocessed;');

  if (!row) {
    throw new Error('getMessageCount: Unable to get count of unprocessed');
  }

  return row['count(*)'];
}

async function getAllUnprocessed() {
  const db = getInstance();
  const rows = await db.all(
    'SELECT * FROM unprocessed ORDER BY timestamp ASC;'
  );

  return rows;
}

async function removeUnprocessed(id: string | Array<string>) {
  const db = getInstance();

  if (!Array.isArray(id)) {
    await db.run('DELETE FROM unprocessed WHERE id = $id;', { $id: id });

    return;
  }

  if (!id.length) {
    throw new Error('removeUnprocessed: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM unprocessed WHERE id IN ( ${id.map(() => '?').join(', ')} );`,
    id
  );
}

async function removeAllUnprocessed() {
  const db = getInstance();
  await db.run('DELETE FROM unprocessed;');
}

// Attachment Downloads

const ATTACHMENT_DOWNLOADS_TABLE = 'attachment_downloads';
async function getNextAttachmentDownloadJobs(
  limit?: number,
  options: { timestamp?: number } = {}
) {
  const db = getInstance();
  const timestamp =
    options && options.timestamp ? options.timestamp : Date.now();

  const rows = await db.all(
    `SELECT json FROM attachment_downloads
    WHERE pending = 0 AND timestamp < $timestamp
    ORDER BY timestamp DESC
    LIMIT $limit;`,
    {
      $limit: limit || 3,
      $timestamp: timestamp,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}
async function saveAttachmentDownloadJob(job: AttachmentDownloadJobType) {
  const db = getInstance();
  const { id, pending, timestamp } = job;
  if (!id) {
    throw new Error(
      'saveAttachmentDownloadJob: Provided job did not have a truthy id'
    );
  }

  await db.run(
    `INSERT OR REPLACE INTO attachment_downloads (
      id,
      pending,
      timestamp,
      json
    ) values (
      $id,
      $pending,
      $timestamp,
      $json
    )`,
    {
      $id: id,
      $pending: pending,
      $timestamp: timestamp,
      $json: objectToJSON(job),
    }
  );
}
async function setAttachmentDownloadJobPending(id: string, pending: boolean) {
  const db = getInstance();
  await db.run(
    'UPDATE attachment_downloads SET pending = $pending WHERE id = $id;',
    {
      $id: id,
      $pending: pending,
    }
  );
}
async function resetAttachmentDownloadPending() {
  const db = getInstance();
  await db.run(
    'UPDATE attachment_downloads SET pending = 0 WHERE pending != 0;'
  );
}
async function removeAttachmentDownloadJob(id: string) {
  return removeById(ATTACHMENT_DOWNLOADS_TABLE, id);
}
async function removeAllAttachmentDownloadJobs() {
  return removeAllFromTable(ATTACHMENT_DOWNLOADS_TABLE);
}

// Stickers

async function createOrUpdateStickerPack(pack: StickerPackType) {
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

  const rows = await db.all('SELECT id FROM sticker_packs WHERE id = $id;', {
    $id: id,
  });
  const payload = {
    $attemptedStatus: attemptedStatus,
    $author: author,
    $coverStickerId: coverStickerId,
    $createdAt: createdAt || Date.now(),
    $downloadAttempts: downloadAttempts || 1,
    $id: id,
    $installedAt: installedAt,
    $key: key,
    $lastUsed: lastUsed || null,
    $status: status,
    $stickerCount: stickerCount,
    $title: title,
  };

  if (rows && rows.length) {
    await db.run(
      `UPDATE sticker_packs SET
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
      WHERE id = $id;`,
      payload
    );

    return;
  }

  await db.run(
    `INSERT INTO sticker_packs (
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
    )`,
    payload
  );
}
async function updateStickerPackStatus(
  id: string,
  status: StickerPackStatusType,
  options?: { timestamp: number }
) {
  const db = getInstance();
  const timestamp = options ? options.timestamp || Date.now() : Date.now();
  const installedAt = status === 'installed' ? timestamp : null;

  await db.run(
    `UPDATE sticker_packs
    SET status = $status, installedAt = $installedAt
    WHERE id = $id;
    )`,
    {
      $id: id,
      $status: status,
      $installedAt: installedAt,
    }
  );
}
async function clearAllErrorStickerPackAttempts(): Promise<void> {
  const db = getInstance();

  await db.run(
    "UPDATE sticker_packs SET downloadAttempts = 0 WHERE status = 'error';"
  );
}
async function createOrUpdateSticker(sticker: StickerType) {
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

  await db.run(
    `INSERT OR REPLACE INTO stickers (
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
    )`,
    {
      $emoji: emoji,
      $height: height,
      $id: id,
      $isCoverOnly: isCoverOnly,
      $lastUsed: lastUsed,
      $packId: packId,
      $path: path,
      $width: width,
    }
  );
}
async function updateStickerLastUsed(
  packId: string,
  stickerId: number,
  lastUsed: number
) {
  const db = getInstance();
  await db.run(
    `UPDATE stickers
    SET lastUsed = $lastUsed
    WHERE id = $id AND packId = $packId;`,
    {
      $id: stickerId,
      $packId: packId,
      $lastUsed: lastUsed,
    }
  );
  await db.run(
    `UPDATE sticker_packs
    SET lastUsed = $lastUsed
    WHERE id = $id;`,
    {
      $id: packId,
      $lastUsed: lastUsed,
    }
  );
}
async function addStickerPackReference(messageId: string, packId: string) {
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

  await db.run(
    `INSERT OR REPLACE INTO sticker_references (
      messageId,
      packId
    ) values (
      $messageId,
      $packId
    )`,
    {
      $messageId: messageId,
      $packId: packId,
    }
  );
}
async function deleteStickerPackReference(messageId: string, packId: string) {
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

  try {
    // We use an immediate transaction here to immediately acquire an exclusive lock,
    //   which would normally only happen when we did our first write.

    // We need this to ensure that our five queries are all atomic, with no other changes
    //   happening while we do it:
    // 1. Delete our target messageId/packId references
    // 2. Check the number of references still pointing at packId
    // 3. If that number is zero, get pack from sticker_packs database
    // 4. If it's not installed, then grab all of its sticker paths
    // 5. If it's not installed, then sticker pack (which cascades to all stickers and
    //      references)
    await db.run('BEGIN IMMEDIATE TRANSACTION;');

    await db.run(
      `DELETE FROM sticker_references
      WHERE messageId = $messageId AND packId = $packId;`,
      {
        $messageId: messageId,
        $packId: packId,
      }
    );

    const countRow = await db.get(
      `SELECT count(*) FROM sticker_references
      WHERE packId = $packId;`,
      { $packId: packId }
    );
    if (!countRow) {
      throw new Error(
        'deleteStickerPackReference: Unable to get count of references'
      );
    }
    const count = countRow['count(*)'];
    if (count > 0) {
      await db.run('COMMIT TRANSACTION;');

      return [];
    }

    const packRow = await db.get(
      `SELECT status FROM sticker_packs
      WHERE id = $packId;`,
      { $packId: packId }
    );
    if (!packRow) {
      console.log('deleteStickerPackReference: did not find referenced pack');
      await db.run('COMMIT TRANSACTION;');

      return [];
    }
    const { status } = packRow;

    if (status === 'installed') {
      await db.run('COMMIT TRANSACTION;');

      return [];
    }

    const stickerPathRows = await db.all(
      `SELECT path FROM stickers
      WHERE packId = $packId;`,
      {
        $packId: packId,
      }
    );
    await db.run(
      `DELETE FROM sticker_packs
      WHERE id = $packId;`,
      { $packId: packId }
    );

    await db.run('COMMIT TRANSACTION;');

    return (stickerPathRows || []).map(row => row.path);
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
deleteStickerPackReference.needsSerial = true;

async function deleteStickerPack(packId: string) {
  const db = getInstance();

  if (!packId) {
    throw new Error(
      'deleteStickerPack: Provided data did not have a truthy packId'
    );
  }

  try {
    // We use an immediate transaction here to immediately acquire an exclusive lock,
    //   which would normally only happen when we did our first write.

    // We need this to ensure that our two queries are atomic, with no other changes
    //   happening while we do it:
    // 1. Grab all of target pack's sticker paths
    // 2. Delete sticker pack (which cascades to all stickers and references)
    await db.run('BEGIN IMMEDIATE TRANSACTION;');

    const stickerPathRows = await db.all(
      `SELECT path FROM stickers
      WHERE packId = $packId;`,
      {
        $packId: packId,
      }
    );
    await db.run(
      `DELETE FROM sticker_packs
      WHERE id = $packId;`,
      { $packId: packId }
    );

    await db.run('COMMIT TRANSACTION;');

    return (stickerPathRows || []).map(row => row.path);
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
deleteStickerPack.needsSerial = true;

async function getStickerCount() {
  const db = getInstance();

  const row = await db.get('SELECT count(*) from stickers;');

  if (!row) {
    throw new Error('getStickerCount: Unable to get count of stickers');
  }

  return row['count(*)'];
}
async function getAllStickerPacks() {
  const db = getInstance();

  const rows = await db.all(
    `SELECT * FROM sticker_packs
    ORDER BY installedAt DESC, createdAt DESC`
  );

  return rows || [];
}
async function getAllStickers() {
  const db = getInstance();

  const rows = await db.all(
    `SELECT * FROM stickers
    ORDER BY packId ASC, id ASC`
  );

  return rows || [];
}
async function getRecentStickers({ limit }: { limit?: number } = {}) {
  const db = getInstance();

  // Note: we avoid 'IS NOT NULL' here because it does seem to bypass our index
  const rows = await db.all(
    `SELECT stickers.* FROM stickers
    JOIN sticker_packs on stickers.packId = sticker_packs.id
    WHERE stickers.lastUsed > 0 AND sticker_packs.status = 'installed'
    ORDER BY stickers.lastUsed DESC
    LIMIT $limit`,
    {
      $limit: limit || 24,
    }
  );

  return rows || [];
}

// Emojis
async function updateEmojiUsage(
  shortName: string,
  timeUsed: number = Date.now()
) {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    const rows = await db.get(
      'SELECT * FROM emojis WHERE shortName = $shortName;',
      {
        $shortName: shortName,
      }
    );

    if (rows) {
      await db.run(
        'UPDATE emojis SET lastUsage = $timeUsed WHERE shortName = $shortName;',
        { $shortName: shortName, $timeUsed: timeUsed }
      );
    } else {
      await db.run(
        'INSERT INTO emojis(shortName, lastUsage) VALUES ($shortName, $timeUsed);',
        { $shortName: shortName, $timeUsed: timeUsed }
      );
    }

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
updateEmojiUsage.needsSerial = true;

async function getRecentEmojis(limit = 32) {
  const db = getInstance();
  const rows = await db.all(
    'SELECT * FROM emojis ORDER BY lastUsage DESC LIMIT $limit;',
    {
      $limit: limit,
    }
  );

  return rows || [];
}

// All data in database
async function removeAll() {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      db.run('DELETE FROM conversations;'),
      db.run('DELETE FROM identityKeys;'),
      db.run('DELETE FROM items;'),
      db.run('DELETE FROM messages;'),
      db.run('DELETE FROM preKeys;'),
      db.run('DELETE FROM sessions;'),
      db.run('DELETE FROM signedPreKeys;'),
      db.run('DELETE FROM unprocessed;'),
      db.run('DELETE FROM attachment_downloads;'),
      db.run('DELETE FROM messages_fts;'),
      db.run('DELETE FROM stickers;'),
      db.run('DELETE FROM sticker_packs;'),
      db.run('DELETE FROM sticker_references;'),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
removeAll.needsSerial = true;

// Anything that isn't user-visible data
async function removeAllConfiguration() {
  const db = getInstance();
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      db.run('DELETE FROM identityKeys;'),
      db.run('DELETE FROM items;'),
      db.run('DELETE FROM preKeys;'),
      db.run('DELETE FROM sessions;'),
      db.run('DELETE FROM signedPreKeys;'),
      db.run('DELETE FROM unprocessed;'),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
removeAllConfiguration.needsSerial = true;

async function getMessagesNeedingUpgrade(
  limit: number,
  { maxVersion }: { maxVersion: number }
) {
  const db = getInstance();
  const rows = await db.all(
    `SELECT json FROM messages
     WHERE schemaVersion IS NULL OR schemaVersion < $maxVersion
     LIMIT $limit;`,
    {
      $maxVersion: maxVersion,
      $limit: limit,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getMessagesWithVisualMediaAttachments(
  conversationId: string,
  { limit }: { limit: number }
) {
  const db = getInstance();
  const rows = await db.all(
    `SELECT json FROM messages WHERE
      conversationId = $conversationId AND
      hasVisualMediaAttachments = 1
     ORDER BY received_at DESC, sent_at DESC
     LIMIT $limit;`,
    {
      $conversationId: conversationId,
      $limit: limit,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getMessagesWithFileAttachments(
  conversationId: string,
  { limit }: { limit: number }
) {
  const db = getInstance();
  const rows = await db.all(
    `SELECT json FROM messages WHERE
      conversationId = $conversationId AND
      hasFileAttachments = 1
     ORDER BY received_at DESC, sent_at DESC
     LIMIT $limit;`,
    {
      $conversationId: conversationId,
      $limit: limit,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

function getExternalFilesForMessage(message: MessageType) {
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
) {
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
) {
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

async function removeKnownAttachments(allAttachments: Array<string>) {
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
    const rows = await db.all(
      `SELECT json FROM messages
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`,
      {
        $id: id,
        $chunkSize: chunkSize,
      }
    );

    const messages: Array<MessageType> = map(rows, row =>
      jsonToObject(row.json)
    );
    forEach(messages, message => {
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
    const rows = await db.all(
      `SELECT json FROM conversations
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`,
      {
        $id: id,
        $chunkSize: chunkSize,
      }
    );

    const conversations: Array<ConversationType> = map(rows, row =>
      jsonToObject(row.json)
    );
    forEach(conversations, conversation => {
      const externalFiles = getExternalFilesForConversation(conversation);
      forEach(externalFiles, file => {
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

async function removeKnownStickers(allStickers: Array<string>) {
  const db = getInstance();
  const lookup: Dictionary<boolean> = fromPairs(
    map(allStickers, file => [file, true])
  );
  const chunkSize = 50;

  const total = await getStickerCount();
  console.log(
    `removeKnownStickers: About to iterate through ${total} stickers`
  );

  let count = 0;
  let complete = false;
  let rowid = 0;

  while (!complete) {
    const rows = await db.all(
      `SELECT rowid, path FROM stickers
       WHERE rowid > $rowid
       ORDER BY rowid ASC
       LIMIT $chunkSize;`,
      {
        $rowid: rowid,
        $chunkSize: chunkSize,
      }
    );

    const files: Array<StickerType> = map(rows, row => row.path);
    forEach(files, file => {
      delete lookup[file];
    });

    const lastSticker: StickerType | undefined = last(rows);
    if (lastSticker) {
      ({ rowid } = lastSticker);
    }
    complete = rows.length < chunkSize;
    count += rows.length;
  }

  console.log(`removeKnownStickers: Done processing ${count} stickers`);

  return Object.keys(lookup);
}

async function removeKnownDraftAttachments(allStickers: Array<string>) {
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
  let id = 0;

  while (!complete) {
    const rows = await db.all(
      `SELECT json FROM conversations
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`,
      {
        $id: id,
        $chunkSize: chunkSize,
      }
    );

    const conversations: Array<ConversationType> = map(rows, row =>
      jsonToObject(row.json)
    );
    forEach(conversations, conversation => {
      const externalFiles = getExternalDraftFilesForConversation(conversation);
      forEach(externalFiles, file => {
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
