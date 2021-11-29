// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

import { mkdirSync } from 'fs';
import { join } from 'path';
import rimraf from 'rimraf';
import type { Database, Statement } from 'better-sqlite3';
import SQL from 'better-sqlite3';
import pProps from 'p-props';

import type { Dictionary } from 'lodash';
import {
  forEach,
  fromPairs,
  isNil,
  isNumber,
  isString,
  last,
  map,
  mapValues,
  omit,
  pick,
} from 'lodash';

import { ReadStatus } from '../messages/MessageReadStatus';
import type { GroupV2MemberType } from '../model-types.d';
import type { ReactionType } from '../types/Reactions';
import { STORAGE_UI_KEYS } from '../types/StorageUIKeys';
import { UUID } from '../types/UUID';
import type { UUIDStringType } from '../types/UUID';
import type { StoredJob } from '../jobs/types';
import { assert, assertSync } from '../util/assert';
import { combineNames } from '../util/combineNames';
import { consoleLogger } from '../util/consoleLogger';
import { dropNull } from '../util/dropNull';
import { isNormalNumber } from '../util/isNormalNumber';
import { isNotNil } from '../util/isNotNil';
import { missingCaseError } from '../util/missingCaseError';
import { parseIntOrThrow } from '../util/parseIntOrThrow';
import * as durations from '../util/durations';
import { formatCountForLogging } from '../logging/formatCountForLogging';
import type { ConversationColorType, CustomColorType } from '../types/Colors';
import { ProcessGroupCallRingRequestResult } from '../types/Calling';
import { RemoveAllConfiguration } from '../types/RemoveAllConfiguration';
import type { BadgeType, BadgeImageType } from '../badges/types';
import { parseBadgeCategory } from '../badges/BadgeCategory';
import { parseBadgeImageTheme } from '../badges/BadgeImageTheme';
import type { LoggerType } from '../types/Logging';
import * as log from '../logging/log';
import type { EmptyQuery, ArrayQuery, Query, JSONRows } from './util';
import {
  jsonToObject,
  objectToJSON,
  batchMultiVarQuery,
  getCountFromTable,
  removeById,
  removeAllFromTable,
  getAllFromTable,
  getById,
  bulkAdd,
  createOrUpdate,
  TableIterator,
  setUserVersion,
  getUserVersion,
  getSchemaVersion,
} from './util';
import { updateSchema } from './migrations';

import type {
  AllItemsType,
  AttachmentDownloadJobType,
  ConversationMetricsType,
  ConversationType,
  DeleteSentProtoRecipientOptionsType,
  EmojiType,
  IdentityKeyType,
  IdentityKeyIdType,
  ItemKeyType,
  ItemType,
  LastConversationMessagesServerType,
  MessageMetricsType,
  MessageType,
  MessageTypeUnhydrated,
  PreKeyType,
  PreKeyIdType,
  SearchResultMessageType,
  SenderKeyType,
  SenderKeyIdType,
  SentMessageDBType,
  SentMessagesType,
  SentProtoType,
  SentProtoWithMessageIdsType,
  SentRecipientsDBType,
  SentRecipientsType,
  ServerInterface,
  SessionType,
  SessionIdType,
  SignedPreKeyType,
  SignedPreKeyIdType,
  StickerPackStatusType,
  StickerPackType,
  StickerType,
  UnprocessedType,
  UnprocessedUpdateType,
} from './Interface';

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
  removeItemById,
  removeAllItems,

  createOrUpdateSenderKey,
  getSenderKeyById,
  removeAllSenderKeys,
  getAllSenderKeys,
  removeSenderKeyById,

  insertSentProto,
  deleteSentProtosOlderThan,
  deleteSentProtoByMessageId,
  insertProtoRecipients,
  deleteSentProtoRecipient,
  getSentProtoByRecipient,
  removeAllSentProtos,
  getAllSentProtos,
  _getAllSentProtoRecipients,
  _getAllSentProtoMessageIds,

  createOrUpdateSession,
  createOrUpdateSessions,
  commitSessionsAndUnprocessed,
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
  getAllGroupsInvolvingUuid,
  updateAllConversationColors,

  searchConversations,
  searchMessages,
  searchMessagesInConversation,

  getMessageCount,
  saveMessage,
  saveMessages,
  removeMessage,
  removeMessages,
  getUnreadCountForConversation,
  getUnreadByConversationAndMarkRead,
  getUnreadReactionsAndMarkRead,
  markReactionAsRead,
  addReaction,
  removeReactionFromConversation,
  _getAllReactions,
  getMessageBySender,
  getMessageById,
  getMessagesById,
  _getAllMessages,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getMessagesUnexpectedlyMissingExpirationStartTimestamp,
  getSoonestMessageExpiry,
  getNextTapToViewMessageTimestampToAgeOut,
  getTapToViewMessagesNeedingErase,
  getOlderMessagesByConversation,
  getNewerMessagesByConversation,
  getMessageMetricsForConversation,
  getLastConversationMessages,
  hasGroupCallHistoryMessage,
  migrateConversationMessages,

  getUnprocessedCount,
  getAllUnprocessed,
  updateUnprocessedWithData,
  updateUnprocessedsWithData,
  getUnprocessedById,
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

  getAllBadges,
  updateOrCreateBadges,
  badgeImageFileDownloaded,

  removeAll,
  removeAllConfiguration,

  getMessagesNeedingUpgrade,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,
  getMessageServerGuidsForSpam,

  getJobsInQueue,
  insertJob,
  deleteJob,

  processGroupCallRingRequest,
  processGroupCallRingCancelation,
  cleanExpiredGroupCallRings,

  getMaxMessageCounter,

  getStatisticsForLogging,

  // Server-only

  getCorruptionLog,
  initialize,
  initializeRenderer,

  removeKnownAttachments,
  removeKnownStickers,
  removeKnownDraftAttachments,
  getAllBadgeImageFileLocalPaths,
};
export default dataInterface;

type DatabaseQueryCache = Map<string, Statement<Array<unknown>>>;

const statementCache = new WeakMap<Database, DatabaseQueryCache>();

function prepare<T>(db: Database, query: string): Statement<T> {
  let dbCache = statementCache.get(db);
  if (!dbCache) {
    dbCache = new Map();
    statementCache.set(db, dbCache);
  }

  let result = dbCache.get(query) as Statement<T>;
  if (!result) {
    result = db.prepare<T>(query);
    dbCache.set(query, result);
  }

  return result;
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
    emoji: dropNull(row.emoji),
  };
}

function isRenderer() {
  if (typeof process === 'undefined' || !process) {
    return true;
  }

  return process.type === 'renderer';
}

function keyDatabase(db: Database, key: string): void {
  // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
  db.pragma(`key = "x'${key}'"`);
}

function switchToWAL(db: Database): void {
  // https://sqlite.org/wal.html
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
}

function migrateSchemaVersion(db: Database): void {
  const userVersion = getUserVersion(db);
  if (userVersion > 0) {
    return;
  }

  const schemaVersion = getSchemaVersion(db);
  const newUserVersion = schemaVersion > 18 ? 16 : schemaVersion;
  logger.info(
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
    switchToWAL(db);
    migrateSchemaVersion(db);

    return db;
  } catch (error) {
    if (db) {
      db.close();
    }
    logger.info('migrateDatabase: Migration without cipher change failed');
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
  switchToWAL(db);

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

let globalInstance: Database | undefined;
let logger = consoleLogger;
let globalInstanceRenderer: Database | undefined;
let databaseFilePath: string | undefined;
let indexedDBPath: string | undefined;

let corruptionLog = new Array<string>();

SQL.setCorruptionLogger(line => {
  logger.error(`SQL corruption: ${line}`);
  corruptionLog.push(line);
});

function getCorruptionLog(): string {
  const result = corruptionLog.join('\n');
  corruptionLog = [];
  return result;
}

async function initialize({
  configDir,
  key,
  logger: suppliedLogger,
}: {
  configDir: string;
  key: string;
  logger: LoggerType;
}): Promise<void> {
  if (globalInstance) {
    throw new Error('Cannot initialize more than once!');
  }

  if (!isString(configDir)) {
    throw new Error('initialize: configDir is required!');
  }
  if (!isString(key)) {
    throw new Error('initialize: key is required!');
  }

  logger = suppliedLogger;

  indexedDBPath = join(configDir, 'IndexedDB');

  const dbDir = join(configDir, 'sql');
  mkdirSync(dbDir, { recursive: true });

  databaseFilePath = join(dbDir, 'db.sqlite');

  let db: Database | undefined;

  try {
    db = openAndSetUpSQLCipher(databaseFilePath, { key });

    // For profiling use:
    // db.pragma('cipher_profile=\'sqlcipher.log\'');

    updateSchema(db, logger);

    // At this point we can allow general access to the database
    globalInstance = db;

    // test database
    getMessageCountSync();
  } catch (error) {
    logger.error('Database startup error:', error.stack);
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
}): Promise<void> {
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
    getMessageCountSync();
  } catch (error) {
    log.error('Database startup error:', error.stack);
    throw error;
  }
}

async function close(): Promise<void> {
  for (const dbRef of [globalInstanceRenderer, globalInstance]) {
    // SQLLite documentation suggests that we run `PRAGMA optimize` right
    // before closing the database connection.
    dbRef?.pragma('optimize');

    dbRef?.close();
  }

  globalInstance = undefined;
  globalInstanceRenderer = undefined;
}

async function removeDB(): Promise<void> {
  if (globalInstance) {
    try {
      globalInstance.close();
    } catch (error) {
      logger.error('removeDB: Failed to close database:', error.stack);
    }
    globalInstance = undefined;
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
async function createOrUpdateIdentityKey(data: IdentityKeyType): Promise<void> {
  return createOrUpdate(getInstance(), IDENTITY_KEYS_TABLE, data);
}
async function getIdentityKeyById(
  id: IdentityKeyIdType
): Promise<IdentityKeyType | undefined> {
  return getById(getInstance(), IDENTITY_KEYS_TABLE, id);
}
async function bulkAddIdentityKeys(
  array: Array<IdentityKeyType>
): Promise<void> {
  return bulkAdd(getInstance(), IDENTITY_KEYS_TABLE, array);
}
async function removeIdentityKeyById(id: IdentityKeyIdType): Promise<void> {
  return removeById(getInstance(), IDENTITY_KEYS_TABLE, id);
}
async function removeAllIdentityKeys(): Promise<void> {
  return removeAllFromTable(getInstance(), IDENTITY_KEYS_TABLE);
}
async function getAllIdentityKeys(): Promise<Array<IdentityKeyType>> {
  return getAllFromTable(getInstance(), IDENTITY_KEYS_TABLE);
}

const PRE_KEYS_TABLE = 'preKeys';
async function createOrUpdatePreKey(data: PreKeyType): Promise<void> {
  return createOrUpdate(getInstance(), PRE_KEYS_TABLE, data);
}
async function getPreKeyById(
  id: PreKeyIdType
): Promise<PreKeyType | undefined> {
  return getById(getInstance(), PRE_KEYS_TABLE, id);
}
async function bulkAddPreKeys(array: Array<PreKeyType>): Promise<void> {
  return bulkAdd(getInstance(), PRE_KEYS_TABLE, array);
}
async function removePreKeyById(id: PreKeyIdType): Promise<void> {
  return removeById(getInstance(), PRE_KEYS_TABLE, id);
}
async function removeAllPreKeys(): Promise<void> {
  return removeAllFromTable(getInstance(), PRE_KEYS_TABLE);
}
async function getAllPreKeys(): Promise<Array<PreKeyType>> {
  return getAllFromTable(getInstance(), PRE_KEYS_TABLE);
}

const SIGNED_PRE_KEYS_TABLE = 'signedPreKeys';
async function createOrUpdateSignedPreKey(
  data: SignedPreKeyType
): Promise<void> {
  return createOrUpdate(getInstance(), SIGNED_PRE_KEYS_TABLE, data);
}
async function getSignedPreKeyById(
  id: SignedPreKeyIdType
): Promise<SignedPreKeyType | undefined> {
  return getById(getInstance(), SIGNED_PRE_KEYS_TABLE, id);
}
async function bulkAddSignedPreKeys(
  array: Array<SignedPreKeyType>
): Promise<void> {
  return bulkAdd(getInstance(), SIGNED_PRE_KEYS_TABLE, array);
}
async function removeSignedPreKeyById(id: SignedPreKeyIdType): Promise<void> {
  return removeById(getInstance(), SIGNED_PRE_KEYS_TABLE, id);
}
async function removeAllSignedPreKeys(): Promise<void> {
  return removeAllFromTable(getInstance(), SIGNED_PRE_KEYS_TABLE);
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
async function createOrUpdateItem<K extends ItemKeyType>(
  data: ItemType<K>
): Promise<void> {
  return createOrUpdate(getInstance(), ITEMS_TABLE, data);
}
async function getItemById<K extends ItemKeyType>(
  id: K
): Promise<ItemType<K> | undefined> {
  return getById(getInstance(), ITEMS_TABLE, id);
}
async function getAllItems(): Promise<AllItemsType> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<EmptyQuery>('SELECT json FROM items ORDER BY id ASC;')
    .all();

  type RawItemType = { id: ItemKeyType; value: unknown };

  const items = rows.map(row => jsonToObject<RawItemType>(row.json));

  const result: Record<ItemKeyType, unknown> = Object.create(null);

  for (const { id, value } of items) {
    result[id] = value;
  }

  return result as unknown as AllItemsType;
}
async function removeItemById(id: ItemKeyType): Promise<void> {
  return removeById(getInstance(), ITEMS_TABLE, id);
}
async function removeAllItems(): Promise<void> {
  return removeAllFromTable(getInstance(), ITEMS_TABLE);
}

async function createOrUpdateSenderKey(key: SenderKeyType): Promise<void> {
  const db = getInstance();

  prepare(
    db,
    `
    INSERT OR REPLACE INTO senderKeys (
      id,
      senderId,
      distributionId,
      data,
      lastUpdatedDate
    ) values (
      $id,
      $senderId,
      $distributionId,
      $data,
      $lastUpdatedDate
    )
    `
  ).run(key);
}
async function getSenderKeyById(
  id: SenderKeyIdType
): Promise<SenderKeyType | undefined> {
  const db = getInstance();
  const row = prepare(db, 'SELECT * FROM senderKeys WHERE id = $id').get({
    id,
  });

  return row;
}
async function removeAllSenderKeys(): Promise<void> {
  const db = getInstance();
  prepare<EmptyQuery>(db, 'DELETE FROM senderKeys').run();
}
async function getAllSenderKeys(): Promise<Array<SenderKeyType>> {
  const db = getInstance();
  const rows = prepare<EmptyQuery>(db, 'SELECT * FROM senderKeys').all();

  return rows;
}
async function removeSenderKeyById(id: SenderKeyIdType): Promise<void> {
  const db = getInstance();
  prepare(db, 'DELETE FROM senderKeys WHERE id = $id').run({ id });
}

async function insertSentProto(
  proto: SentProtoType,
  options: {
    recipients: SentRecipientsType;
    messageIds: SentMessagesType;
  }
): Promise<number> {
  const db = getInstance();
  const { recipients, messageIds } = options;

  // Note: we use `pluck` in this function to fetch only the first column of returned row.

  return db.transaction(() => {
    // 1. Insert the payload, fetching its primary key id
    const info = prepare(
      db,
      `
      INSERT INTO sendLogPayloads (
        contentHint,
        proto,
        timestamp
      ) VALUES (
        $contentHint,
        $proto,
        $timestamp
      );
      `
    ).run(proto);
    const id = parseIntOrThrow(
      info.lastInsertRowid,
      'insertSentProto/lastInsertRowid'
    );

    // 2. Insert a record for each recipient device.
    const recipientStatement = prepare(
      db,
      `
      INSERT INTO sendLogRecipients (
        payloadId,
        recipientUuid,
        deviceId
      ) VALUES (
        $id,
        $recipientUuid,
        $deviceId
      );
      `
    );

    const recipientUuids = Object.keys(recipients);
    for (const recipientUuid of recipientUuids) {
      const deviceIds = recipients[recipientUuid];

      for (const deviceId of deviceIds) {
        recipientStatement.run({
          id,
          recipientUuid,
          deviceId,
        });
      }
    }

    // 2. Insert a record for each message referenced by this payload.
    const messageStatement = prepare(
      db,
      `
      INSERT INTO sendLogMessageIds (
        payloadId,
        messageId
      ) VALUES (
        $id,
        $messageId
      );
      `
    );

    for (const messageId of messageIds) {
      messageStatement.run({
        id,
        messageId,
      });
    }

    return id;
  })();
}

async function deleteSentProtosOlderThan(timestamp: number): Promise<void> {
  const db = getInstance();

  prepare(
    db,
    `
    DELETE FROM sendLogPayloads
    WHERE
      timestamp IS NULL OR
      timestamp < $timestamp;
    `
  ).run({
    timestamp,
  });
}

async function deleteSentProtoByMessageId(messageId: string): Promise<void> {
  const db = getInstance();

  prepare(
    db,
    `
    DELETE FROM sendLogPayloads WHERE id IN (
      SELECT payloadId FROM sendLogMessageIds
      WHERE messageId = $messageId
    );
    `
  ).run({
    messageId,
  });
}

async function insertProtoRecipients({
  id,
  recipientUuid,
  deviceIds,
}: {
  id: number;
  recipientUuid: string;
  deviceIds: Array<number>;
}): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    const statement = prepare(
      db,
      `
      INSERT INTO sendLogRecipients (
        payloadId,
        recipientUuid,
        deviceId
      ) VALUES (
        $id,
        $recipientUuid,
        $deviceId
      );
      `
    );

    for (const deviceId of deviceIds) {
      statement.run({
        id,
        recipientUuid,
        deviceId,
      });
    }
  })();
}

async function deleteSentProtoRecipient(
  options:
    | DeleteSentProtoRecipientOptionsType
    | ReadonlyArray<DeleteSentProtoRecipientOptionsType>
): Promise<void> {
  const db = getInstance();

  const items = Array.isArray(options) ? options : [options];

  // Note: we use `pluck` in this function to fetch only the first column of
  // returned row.

  db.transaction(() => {
    for (const item of items) {
      const { timestamp, recipientUuid, deviceId } = item;

      // 1. Figure out what payload we're talking about.
      const rows = prepare(
        db,
        `
        SELECT sendLogPayloads.id FROM sendLogPayloads
        INNER JOIN sendLogRecipients
          ON sendLogRecipients.payloadId = sendLogPayloads.id
        WHERE
          sendLogPayloads.timestamp = $timestamp AND
          sendLogRecipients.recipientUuid = $recipientUuid AND
          sendLogRecipients.deviceId = $deviceId;
       `
      ).all({ timestamp, recipientUuid, deviceId });
      if (!rows.length) {
        continue;
      }
      if (rows.length > 1) {
        logger.warn(
          'deleteSentProtoRecipient: More than one payload matches ' +
            `recipient and timestamp ${timestamp}. Using the first.`
        );
        continue;
      }

      const { id } = rows[0];

      // 2. Delete the recipient/device combination in question.
      prepare(
        db,
        `
        DELETE FROM sendLogRecipients
        WHERE
          payloadId = $id AND
          recipientUuid = $recipientUuid AND
          deviceId = $deviceId;
        `
      ).run({ id, recipientUuid, deviceId });

      // 3. See how many more recipient devices there were for this payload.
      const remaining = prepare(
        db,
        'SELECT count(*) FROM sendLogRecipients WHERE payloadId = $id;'
      )
        .pluck(true)
        .get({ id });

      if (!isNumber(remaining)) {
        throw new Error(
          'deleteSentProtoRecipient: select count() returned non-number!'
        );
      }

      if (remaining > 0) {
        continue;
      }

      // 4. Delete the entire payload if there are no more recipients left.
      logger.info(
        'deleteSentProtoRecipient: ' +
          `Deleting proto payload for timestamp ${timestamp}`
      );
      prepare(db, 'DELETE FROM sendLogPayloads WHERE id = $id;').run({
        id,
      });
    }
  })();
}

async function getSentProtoByRecipient({
  now,
  recipientUuid,
  timestamp,
}: {
  now: number;
  recipientUuid: string;
  timestamp: number;
}): Promise<SentProtoWithMessageIdsType | undefined> {
  const db = getInstance();

  const HOUR = 1000 * 60 * 60;
  const oneDayAgo = now - HOUR * 24;

  await deleteSentProtosOlderThan(oneDayAgo);

  const row = prepare(
    db,
    `
    SELECT
      sendLogPayloads.*,
      GROUP_CONCAT(DISTINCT sendLogMessageIds.messageId) AS messageIds
    FROM sendLogPayloads
    INNER JOIN sendLogRecipients ON sendLogRecipients.payloadId = sendLogPayloads.id
    LEFT JOIN sendLogMessageIds ON sendLogMessageIds.payloadId = sendLogPayloads.id
    WHERE
      sendLogPayloads.timestamp = $timestamp AND
      sendLogRecipients.recipientUuid = $recipientUuid
    GROUP BY sendLogPayloads.id;
    `
  ).get({
    timestamp,
    recipientUuid,
  });

  if (!row) {
    return undefined;
  }

  const { messageIds } = row;
  return {
    ...row,
    messageIds: messageIds ? messageIds.split(',') : [],
  };
}
async function removeAllSentProtos(): Promise<void> {
  const db = getInstance();
  prepare<EmptyQuery>(db, 'DELETE FROM sendLogPayloads;').run();
}
async function getAllSentProtos(): Promise<Array<SentProtoType>> {
  const db = getInstance();
  const rows = prepare<EmptyQuery>(db, 'SELECT * FROM sendLogPayloads;').all();

  return rows;
}
async function _getAllSentProtoRecipients(): Promise<
  Array<SentRecipientsDBType>
> {
  const db = getInstance();
  const rows = prepare<EmptyQuery>(
    db,
    'SELECT * FROM sendLogRecipients;'
  ).all();

  return rows;
}
async function _getAllSentProtoMessageIds(): Promise<Array<SentMessageDBType>> {
  const db = getInstance();
  const rows = prepare<EmptyQuery>(
    db,
    'SELECT * FROM sendLogMessageIds;'
  ).all();

  return rows;
}

const SESSIONS_TABLE = 'sessions';
function createOrUpdateSessionSync(data: SessionType): void {
  const db = getInstance();
  const { id, conversationId, ourUuid, uuid } = data;
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
      ourUuid,
      uuid,
      json
    ) values (
      $id,
      $conversationId,
      $ourUuid,
      $uuid,
      $json
    )
    `
  ).run({
    id,
    conversationId,
    ourUuid,
    uuid,
    json: objectToJSON(data),
  });
}
async function createOrUpdateSession(data: SessionType): Promise<void> {
  return createOrUpdateSessionSync(data);
}

async function createOrUpdateSessions(
  array: Array<SessionType>
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const item of array) {
      assertSync(createOrUpdateSessionSync(item));
    }
  })();
}

async function commitSessionsAndUnprocessed({
  sessions,
  unprocessed,
}: {
  sessions: Array<SessionType>;
  unprocessed: Array<UnprocessedType>;
}): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const item of sessions) {
      assertSync(createOrUpdateSessionSync(item));
    }

    for (const item of unprocessed) {
      assertSync(saveUnprocessedSync(item));
    }
  })();
}

async function bulkAddSessions(array: Array<SessionType>): Promise<void> {
  return bulkAdd(getInstance(), SESSIONS_TABLE, array);
}
async function removeSessionById(id: SessionIdType): Promise<void> {
  return removeById(getInstance(), SESSIONS_TABLE, id);
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
async function removeAllSessions(): Promise<void> {
  return removeAllFromTable(getInstance(), SESSIONS_TABLE);
}
async function getAllSessions(): Promise<Array<SessionType>> {
  return getAllFromTable(getInstance(), SESSIONS_TABLE);
}
// Conversations

async function getConversationCount(): Promise<number> {
  return getCountFromTable(getInstance(), 'conversations');
}

function getConversationMembersList({ members, membersV2 }: ConversationType) {
  if (membersV2) {
    return membersV2.map((item: GroupV2MemberType) => item.uuid).join(' ');
  }
  if (members) {
    return members.join(' ');
  }
  return null;
}

function saveConversationSync(
  data: ConversationType,
  db = getInstance()
): void {
  const {
    active_at,
    e164,
    groupId,
    id,
    name,
    profileFamilyName,
    profileName,
    profileLastFetchedAt,
    type,
    uuid,
  } = data;

  const membersList = getConversationMembersList(data);

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

async function saveConversation(
  data: ConversationType,
  db = getInstance()
): Promise<void> {
  return saveConversationSync(data, db);
}

async function saveConversations(
  arrayOfConversations: Array<ConversationType>
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const conversation of arrayOfConversations) {
      assertSync(saveConversationSync(conversation));
    }
  })();
}

function updateConversationSync(
  data: ConversationType,
  db = getInstance()
): void {
  const {
    id,
    active_at,
    type,
    name,
    profileName,
    profileFamilyName,
    profileLastFetchedAt,
    e164,
    uuid,
  } = data;

  const membersList = getConversationMembersList(data);

  db.prepare(
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

async function updateConversation(data: ConversationType): Promise<void> {
  return updateConversationSync(data);
}

async function updateConversations(
  array: Array<ConversationType>
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const item of array) {
      assertSync(updateConversationSync(item));
    }
  })();
}

function removeConversationsSync(ids: Array<string>): void {
  const db = getInstance();

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  db.prepare<ArrayQuery>(
    `
    DELETE FROM conversations
    WHERE id IN ( ${ids.map(() => '?').join(', ')} );
    `
  ).run(ids);
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

  batchMultiVarQuery(db, id, removeConversationsSync);
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

function getAllConversationsSync(db = getInstance()): Array<ConversationType> {
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

async function getAllConversations(): Promise<Array<ConversationType>> {
  return getAllConversationsSync();
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

async function getAllGroupsInvolvingUuid(
  uuid: UUIDStringType
): Promise<Array<ConversationType>> {
  const db = getInstance();
  const rows: ConversationRows = db
    .prepare<Query>(
      `
      SELECT json, profileLastFetchedAt
      FROM conversations WHERE
        type = 'group' AND
        members LIKE $uuid
      ORDER BY id ASC;
      `
    )
    .all({
      uuid: `%${uuid}%`,
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

function getMessageCountSync(
  conversationId?: string,
  db = getInstance()
): number {
  if (conversationId === undefined) {
    return getCountFromTable(db, 'messages');
  }

  const count = db
    .prepare<Query>(
      `
        SELECT count(*)
        FROM messages
        WHERE conversationId = $conversationId;
        `
    )
    .pluck()
    .get({ conversationId });

  return count;
}

async function getMessageCount(conversationId?: string): Promise<number> {
  return getMessageCountSync(conversationId);
}

function hasUserInitiatedMessages(conversationId: string): boolean {
  const db = getInstance();

  // We apply the limit in the sub-query so that `json_extract` wouldn't run
  // for additional messages.
  const row: { count: number } = db
    .prepare<Query>(
      `
      SELECT COUNT(*) as count FROM
        (
          SELECT 1 FROM messages
          WHERE
            conversationId = $conversationId AND
            (type IS NULL
              OR
              type NOT IN (
                'profile-change',
                'verified-change',
                'message-history-unsynced',
                'keychange',
                'group-v1-migration',
                'universal-timer-notification',
                'change-number-notification',
                'group-v2-change'
              )
            )
          LIMIT 1
        );
      `
    )
    .get({ conversationId });

  return row.count !== 0;
}

function saveMessageSync(
  data: MessageType,
  options: {
    jobToInsert?: StoredJob;
    forceSave?: boolean;
    alreadyInTransaction?: boolean;
    db?: Database;
  } = {}
): string {
  const {
    jobToInsert,
    forceSave,
    alreadyInTransaction,
    db = getInstance(),
  } = options;

  if (!alreadyInTransaction) {
    return db.transaction(() => {
      return assertSync(
        saveMessageSync(data, {
          ...options,
          alreadyInTransaction: true,
        })
      );
    })();
  }

  const {
    body,
    conversationId,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
    id,
    isErased,
    isViewOnce,
    received_at,
    schemaVersion,
    sent_at,
    serverGuid,
    source,
    sourceUuid,
    sourceDevice,
    type,
    readStatus,
    expireTimer,
    expirationStartTimestamp,
  } = data;

  const payload = {
    id,
    json: objectToJSON(data),

    body: body || null,
    conversationId,
    expirationStartTimestamp: expirationStartTimestamp || null,
    expireTimer: expireTimer || null,
    hasAttachments: hasAttachments ? 1 : 0,
    hasFileAttachments: hasFileAttachments ? 1 : 0,
    hasVisualMediaAttachments: hasVisualMediaAttachments ? 1 : 0,
    isErased: isErased ? 1 : 0,
    isViewOnce: isViewOnce ? 1 : 0,
    received_at: received_at || null,
    schemaVersion: schemaVersion || 0,
    serverGuid: serverGuid || null,
    sent_at: sent_at || null,
    source: source || null,
    sourceUuid: sourceUuid || null,
    sourceDevice: sourceDevice || null,
    type: type || null,
    readStatus: readStatus ?? null,
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
        expireTimer = $expireTimer,
        hasAttachments = $hasAttachments,
        hasFileAttachments = $hasFileAttachments,
        hasVisualMediaAttachments = $hasVisualMediaAttachments,
        isErased = $isErased,
        isViewOnce = $isViewOnce,
        received_at = $received_at,
        schemaVersion = $schemaVersion,
        serverGuid = $serverGuid,
        sent_at = $sent_at,
        source = $source,
        sourceUuid = $sourceUuid,
        sourceDevice = $sourceDevice,
        type = $type,
        readStatus = $readStatus
      WHERE id = $id;
      `
    ).run(payload);

    if (jobToInsert) {
      insertJobSync(db, jobToInsert);
    }

    return id;
  }

  const toCreate = {
    ...data,
    id: id || UUID.generate().toString(),
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
      expireTimer,
      hasAttachments,
      hasFileAttachments,
      hasVisualMediaAttachments,
      isErased,
      isViewOnce,
      received_at,
      schemaVersion,
      serverGuid,
      sent_at,
      source,
      sourceUuid,
      sourceDevice,
      type,
      readStatus
    ) values (
      $id,
      $json,

      $body,
      $conversationId,
      $expirationStartTimestamp,
      $expireTimer,
      $hasAttachments,
      $hasFileAttachments,
      $hasVisualMediaAttachments,
      $isErased,
      $isViewOnce,
      $received_at,
      $schemaVersion,
      $serverGuid,
      $sent_at,
      $source,
      $sourceUuid,
      $sourceDevice,
      $type,
      $readStatus
    );
    `
  ).run({
    ...payload,
    id: toCreate.id,
    json: objectToJSON(toCreate),
  });

  if (jobToInsert) {
    insertJobSync(db, jobToInsert);
  }

  return toCreate.id;
}

async function saveMessage(
  data: MessageType,
  options?: {
    jobToInsert?: StoredJob;
    forceSave?: boolean;
    alreadyInTransaction?: boolean;
  }
): Promise<string> {
  return saveMessageSync(data, options);
}

async function saveMessages(
  arrayOfMessages: Array<MessageType>,
  options?: { forceSave?: boolean }
): Promise<void> {
  const db = getInstance();
  const { forceSave } = options || {};

  db.transaction(() => {
    for (const message of arrayOfMessages) {
      assertSync(
        saveMessageSync(message, { forceSave, alreadyInTransaction: true })
      );
    }
  })();
}

async function removeMessage(id: string): Promise<void> {
  const db = getInstance();

  db.prepare<Query>('DELETE FROM messages WHERE id = $id;').run({ id });
}

function removeMessagesSync(ids: Array<string>): void {
  const db = getInstance();

  db.prepare<ArrayQuery>(
    `
    DELETE FROM messages
    WHERE id IN ( ${ids.map(() => '?').join(', ')} );
    `
  ).run(ids);
}

async function removeMessages(ids: Array<string>): Promise<void> {
  batchMultiVarQuery(getInstance(), ids, removeMessagesSync);
}

async function getMessageById(id: string): Promise<MessageType | undefined> {
  const db = getInstance();
  const row = db
    .prepare<Query>('SELECT json FROM messages WHERE id = $id;')
    .get({
      id,
    });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}

async function getMessagesById(
  messageIds: Array<string>
): Promise<Array<MessageType>> {
  const db = getInstance();

  return batchMultiVarQuery(
    db,
    messageIds,
    (batch: Array<string>): Array<MessageType> => {
      const query = db.prepare<ArrayQuery>(
        `SELECT json FROM messages WHERE id IN (${Array(batch.length)
          .fill('?')
          .join(',')});`
      );
      const rows: JSONRows = query.all(batch);
      return rows.map(row => jsonToObject(row.json));
    }
  );
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
  sourceDevice: number;
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

async function getUnreadCountForConversation(
  conversationId: string
): Promise<number> {
  const db = getInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT COUNT(*) AS unreadCount FROM messages
      WHERE readStatus = ${ReadStatus.Unread} AND
      conversationId = $conversationId AND
      type = 'incoming';
      `
    )
    .get({
      conversationId,
    });
  return row.unreadCount;
}

async function getUnreadByConversationAndMarkRead(
  conversationId: string,
  newestUnreadId: number,
  readAt?: number
): Promise<
  Array<Pick<MessageType, 'id' | 'source' | 'sourceUuid' | 'sent_at' | 'type'>>
> {
  const db = getInstance();
  return db.transaction(() => {
    const expirationStartTimestamp = Math.min(Date.now(), readAt ?? Infinity);
    db.prepare<Query>(
      `
      UPDATE messages
      INDEXED BY expiring_message_by_conversation_and_received_at
      SET
        expirationStartTimestamp = $expirationStartTimestamp,
        json = json_patch(json, $jsonPatch)
      WHERE
        (
          expirationStartTimestamp IS NULL OR
          expirationStartTimestamp > $expirationStartTimestamp
        ) AND
        expireTimer IS NOT NULL AND
        conversationId = $conversationId AND
        received_at <= $newestUnreadId;
      `
    ).run({
      conversationId,
      expirationStartTimestamp,
      jsonPatch: JSON.stringify({ expirationStartTimestamp }),
      newestUnreadId,
    });

    const rows = db
      .prepare<Query>(
        `
        SELECT id, json FROM messages
        INDEXED BY messages_unread
        WHERE
          readStatus = ${ReadStatus.Unread} AND
          conversationId = $conversationId AND
          received_at <= $newestUnreadId
        ORDER BY received_at DESC, sent_at DESC;
        `
      )
      .all({
        conversationId,
        newestUnreadId,
      });

    db.prepare<Query>(
      `
        UPDATE messages
        SET
          readStatus = ${ReadStatus.Read},
          json = json_patch(json, $jsonPatch)
        WHERE
          readStatus = ${ReadStatus.Unread} AND
          conversationId = $conversationId AND
          received_at <= $newestUnreadId;
        `
    ).run({
      conversationId,
      jsonPatch: JSON.stringify({ readStatus: ReadStatus.Read }),
      newestUnreadId,
    });

    return rows.map(row => {
      const json = jsonToObject<MessageType>(row.json);
      return {
        readStatus: ReadStatus.Read,
        ...pick(json, [
          'expirationStartTimestamp',
          'id',
          'sent_at',
          'source',
          'sourceUuid',
          'type',
        ]),
      };
    });
  })();
}

async function getUnreadReactionsAndMarkRead(
  conversationId: string,
  newestUnreadId: number
): Promise<
  Array<
    Pick<ReactionType, 'targetAuthorUuid' | 'targetTimestamp' | 'messageId'>
  >
> {
  const db = getInstance();

  return db.transaction(() => {
    const unreadMessages = db
      .prepare<Query>(
        `
        SELECT targetAuthorUuid, targetTimestamp, messageId
        FROM reactions WHERE
          unread = 1 AND
          conversationId = $conversationId AND
          messageReceivedAt <= $newestUnreadId;
      `
      )
      .all({
        conversationId,
        newestUnreadId,
      });

    db.prepare(
      `
      UPDATE reactions SET
      unread = 0 WHERE
      conversationId = $conversationId AND
      messageReceivedAt <= $newestUnreadId;
    `
    ).run({
      conversationId,
      newestUnreadId,
    });

    return unreadMessages;
  })();
}

async function markReactionAsRead(
  targetAuthorUuid: string,
  targetTimestamp: number
): Promise<ReactionType | undefined> {
  const db = getInstance();
  return db.transaction(() => {
    const readReaction = db
      .prepare(
        `
          SELECT *
          FROM reactions
          WHERE
            targetAuthorUuid = $targetAuthorUuid AND
            targetTimestamp = $targetTimestamp AND
            unread = 1
          ORDER BY rowId DESC
          LIMIT 1;
        `
      )
      .get({
        targetAuthorUuid,
        targetTimestamp,
      });

    db.prepare(
      `
        UPDATE reactions SET
        unread = 0 WHERE
        targetAuthorUuid = $targetAuthorUuid AND
        targetTimestamp = $targetTimestamp;
      `
    ).run({
      targetAuthorUuid,
      targetTimestamp,
    });

    return readReaction;
  })();
}

async function addReaction({
  conversationId,
  emoji,
  fromId,
  messageId,
  messageReceivedAt,
  targetAuthorUuid,
  targetTimestamp,
}: ReactionType): Promise<void> {
  const db = getInstance();
  await db
    .prepare(
      `INSERT INTO reactions (
      conversationId,
      emoji,
      fromId,
      messageId,
      messageReceivedAt,
      targetAuthorUuid,
      targetTimestamp,
      unread
    ) VALUES (
      $conversationId,
      $emoji,
      $fromId,
      $messageId,
      $messageReceivedAt,
      $targetAuthorUuid,
      $targetTimestamp,
      $unread
    );`
    )
    .run({
      conversationId,
      emoji,
      fromId,
      messageId,
      messageReceivedAt,
      targetAuthorUuid,
      targetTimestamp,
      unread: 1,
    });
}

async function removeReactionFromConversation({
  emoji,
  fromId,
  targetAuthorUuid,
  targetTimestamp,
}: {
  emoji: string;
  fromId: string;
  targetAuthorUuid: string;
  targetTimestamp: number;
}): Promise<void> {
  const db = getInstance();
  await db
    .prepare(
      `DELETE FROM reactions WHERE
      emoji = $emoji AND
      fromId = $fromId AND
      targetAuthorUuid = $targetAuthorUuid AND
      targetTimestamp = $targetTimestamp;`
    )
    .run({
      emoji,
      fromId,
      targetAuthorUuid,
      targetTimestamp,
    });
}

async function _getAllReactions(): Promise<Array<ReactionType>> {
  const db = getInstance();
  return db.prepare<EmptyQuery>('SELECT * from reactions;').all();
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

function getLastConversationActivity({
  conversationId,
  ourUuid,
}: {
  conversationId: string;
  ourUuid: UUIDStringType;
}): MessageType | undefined {
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
            'group-v1-migration',
            'universal-timer-notification',
            'change-number-notification'
          )
        ) AND
        (
          json_extract(json, '$.expirationTimerUpdate.fromSync') IS NULL
          OR
          json_extract(json, '$.expirationTimerUpdate.fromSync') != 1
        ) AND NOT
        (
          type = 'group-v2-change' AND
          json_extract(json, '$.groupV2Change.from') != $ourUuid AND
          json_extract(json, '$.groupV2Change.details.length') = 1 AND
          json_extract(json, '$.groupV2Change.details[0].type') = 'member-remove' AND
          json_extract(json, '$.groupV2Change.details[0].uuid') != $ourUuid
        )
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
      `
  ).get({
    conversationId,
    ourUuid,
  });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}
function getLastConversationPreview({
  conversationId,
  ourUuid,
}: {
  conversationId: string;
  ourUuid: UUIDStringType;
}): MessageType | undefined {
  const db = getInstance();
  const row = prepare(
    db,
    `
      SELECT json FROM messages
      WHERE
        conversationId = $conversationId AND
        (
          expiresAt IS NULL OR
          (expiresAt > $now)
        ) AND
        (
          type IS NULL
          OR
          type NOT IN (
            'profile-change',
            'verified-change',
            'message-history-unsynced',
            'group-v1-migration',
            'universal-timer-notification',
            'change-number-notification'
          )
        ) AND NOT
        (
          type = 'group-v2-change' AND
          json_extract(json, '$.groupV2Change.from') != $ourUuid AND
          json_extract(json, '$.groupV2Change.details.length') = 1 AND
          json_extract(json, '$.groupV2Change.details[0].type') = 'member-remove' AND
          json_extract(json, '$.groupV2Change.details[0].uuid') != $ourUuid
        )
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
      `
  ).get({
    conversationId,
    ourUuid,
    now: Date.now(),
  });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}

async function getLastConversationMessages({
  conversationId,
  ourUuid,
}: {
  conversationId: string;
  ourUuid: UUIDStringType;
}): Promise<LastConversationMessagesServerType> {
  const db = getInstance();

  return db.transaction(() => {
    return {
      activity: getLastConversationActivity({
        conversationId,
        ourUuid,
      }),
      preview: getLastConversationPreview({
        conversationId,
        ourUuid,
      }),
      hasUserInitiatedMessages: hasUserInitiatedMessages(conversationId),
    };
  })();
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
        readStatus = ${ReadStatus.Unread}
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
        readStatus = ${ReadStatus.Unread};
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
        expiresAt IS NOT NULL AND
        expiresAt <= $now
      ORDER BY expiresAt ASC;
      `
    )
    .all({ now });

  return rows.map(row => jsonToObject(row.json));
}

async function getMessagesUnexpectedlyMissingExpirationStartTimestamp(): Promise<
  Array<MessageType>
> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<EmptyQuery>(
      `
      SELECT json FROM messages
      INDEXED BY messages_unexpectedly_missing_expiration_start_timestamp
      WHERE
        expireTimer > 0 AND
        expirationStartTimestamp IS NULL AND
        (
          type IS 'outgoing' OR
          (type IS 'incoming' AND (
            readStatus = ${ReadStatus.Read} OR
            readStatus = ${ReadStatus.Viewed} OR
            readStatus IS NULL
          ))
        );
      `
    )
    .all();

  return rows.map(row => jsonToObject(row.json));
}

async function getSoonestMessageExpiry(): Promise<undefined | number> {
  const db = getInstance();

  // Note: we use `pluck` to only get the first column.
  const result: null | number = db
    .prepare<EmptyQuery>(
      `
      SELECT MIN(expiresAt)
      FROM messages;
      `
    )
    .pluck(true)
    .get();

  return result || undefined;
}

async function getNextTapToViewMessageTimestampToAgeOut(): Promise<
  undefined | number
> {
  const db = getInstance();
  const row = db
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
    .get();

  if (!row) {
    return undefined;
  }

  const data = jsonToObject<MessageType>(row.json);
  const result = data.received_at_ms || data.received_at;
  return isNormalNumber(result) ? result : undefined;
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

const MAX_UNPROCESSED_ATTEMPTS = 3;

function saveUnprocessedSync(data: UnprocessedType): string {
  const db = getInstance();
  const {
    id,
    timestamp,
    version,
    attempts,
    envelope,
    source,
    sourceUuid,
    sourceDevice,
    serverGuid,
    serverTimestamp,
    decrypted,
  } = data;
  if (!id) {
    throw new Error('saveUnprocessedSync: id was falsey');
  }

  if (attempts >= MAX_UNPROCESSED_ATTEMPTS) {
    removeUnprocessedSync(id);
    return id;
  }

  prepare(
    db,
    `
    INSERT OR REPLACE INTO unprocessed (
      id,
      timestamp,
      version,
      attempts,
      envelope,
      source,
      sourceUuid,
      sourceDevice,
      serverGuid,
      serverTimestamp,
      decrypted
    ) values (
      $id,
      $timestamp,
      $version,
      $attempts,
      $envelope,
      $source,
      $sourceUuid,
      $sourceDevice,
      $serverGuid,
      $serverTimestamp,
      $decrypted
    );
    `
  ).run({
    id,
    timestamp,
    version,
    attempts,
    envelope: envelope || null,
    source: source || null,
    sourceUuid: sourceUuid || null,
    sourceDevice: sourceDevice || null,
    serverGuid: serverGuid || null,
    serverTimestamp: serverTimestamp || null,
    decrypted: decrypted || null,
  });

  return id;
}

function updateUnprocessedWithDataSync(
  id: string,
  data: UnprocessedUpdateType
): void {
  const db = getInstance();
  const {
    source,
    sourceUuid,
    sourceDevice,
    serverGuid,
    serverTimestamp,
    decrypted,
  } = data;

  prepare(
    db,
    `
    UPDATE unprocessed SET
      source = $source,
      sourceUuid = $sourceUuid,
      sourceDevice = $sourceDevice,
      serverGuid = $serverGuid,
      serverTimestamp = $serverTimestamp,
      decrypted = $decrypted
    WHERE id = $id;
    `
  ).run({
    id,
    source: source || null,
    sourceUuid: sourceUuid || null,
    sourceDevice: sourceDevice || null,
    serverGuid: serverGuid || null,
    serverTimestamp: serverTimestamp || null,
    decrypted: decrypted || null,
  });
}

async function updateUnprocessedWithData(
  id: string,
  data: UnprocessedUpdateType
): Promise<void> {
  return updateUnprocessedWithDataSync(id, data);
}

async function updateUnprocessedsWithData(
  arrayOfUnprocessed: Array<{ id: string; data: UnprocessedUpdateType }>
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const { id, data } of arrayOfUnprocessed) {
      assertSync(updateUnprocessedWithDataSync(id, data));
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
  return getCountFromTable(getInstance(), 'unprocessed');
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

function removeUnprocessedsSync(ids: Array<string>): void {
  const db = getInstance();

  db.prepare<ArrayQuery>(
    `
    DELETE FROM unprocessed
    WHERE id IN ( ${ids.map(() => '?').join(', ')} );
    `
  ).run(ids);
}

function removeUnprocessedSync(id: string | Array<string>): void {
  const db = getInstance();

  if (!Array.isArray(id)) {
    prepare(db, 'DELETE FROM unprocessed WHERE id = $id;').run({ id });

    return;
  }

  if (!id.length) {
    throw new Error('removeUnprocessedSync: No ids to delete!');
  }

  assertSync(batchMultiVarQuery(db, id, removeUnprocessedsSync));
}

async function removeUnprocessed(id: string | Array<string>): Promise<void> {
  removeUnprocessedSync(id);
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
      WHERE pending = 0 AND timestamp <= $timestamp
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
async function removeAttachmentDownloadJob(id: string): Promise<void> {
  return removeById(getInstance(), ATTACHMENT_DOWNLOADS_TABLE, id);
}
async function removeAllAttachmentDownloadJobs(): Promise<void> {
  return removeAllFromTable(getInstance(), ATTACHMENT_DOWNLOADS_TABLE);
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
    attemptedStatus: attemptedStatus ?? null,
    author,
    coverStickerId,
    createdAt: createdAt || Date.now(),
    downloadAttempts: downloadAttempts || 1,
    id,
    installedAt: installedAt ?? null,
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
  const { emoji, height, id, isCoverOnly, lastUsed, packId, path, width } =
    sticker;

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
    emoji: emoji ?? null,
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
): Promise<ReadonlyArray<string> | undefined> {
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
        return undefined;
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
        logger.warn('deleteStickerPackReference: did not find referenced pack');
        return undefined;
      }
      const { status } = packRow;

      if (status === 'installed') {
        return undefined;
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
  return getCountFromTable(getInstance(), 'stickers');
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

async function getAllBadges(): Promise<Array<BadgeType>> {
  const db = getInstance();

  const [badgeRows, badgeImageFileRows] = db.transaction(() => [
    db.prepare<EmptyQuery>('SELECT * FROM badges').all(),
    db.prepare<EmptyQuery>('SELECT * FROM badgeImageFiles').all(),
  ])();

  const badgeImagesByBadge = new Map<
    string,
    Array<undefined | BadgeImageType>
  >();
  for (const badgeImageFileRow of badgeImageFileRows) {
    const { badgeId, order, localPath, url, theme } = badgeImageFileRow;
    const badgeImages = badgeImagesByBadge.get(badgeId) || [];
    badgeImages[order] = {
      ...(badgeImages[order] || {}),
      [parseBadgeImageTheme(theme)]: {
        localPath: dropNull(localPath),
        url,
      },
    };
    badgeImagesByBadge.set(badgeId, badgeImages);
  }

  return badgeRows.map(badgeRow => ({
    id: badgeRow.id,
    category: parseBadgeCategory(badgeRow.category),
    name: badgeRow.name,
    descriptionTemplate: badgeRow.descriptionTemplate,
    images: (badgeImagesByBadge.get(badgeRow.id) || []).filter(isNotNil),
  }));
}

// This should match the logic in the badges Redux reducer.
async function updateOrCreateBadges(
  badges: ReadonlyArray<BadgeType>
): Promise<void> {
  const db = getInstance();

  const insertBadge = prepare<Query>(
    db,
    `
    INSERT OR REPLACE INTO badges (
      id,
      category,
      name,
      descriptionTemplate
    ) VALUES (
      $id,
      $category,
      $name,
      $descriptionTemplate
    );
    `
  );
  const getImageFilesForBadge = prepare<Query>(
    db,
    'SELECT url, localPath FROM badgeImageFiles WHERE badgeId = $badgeId'
  );
  const insertBadgeImageFile = prepare<Query>(
    db,
    `
    INSERT INTO badgeImageFiles (
      badgeId,
      'order',
      url,
      localPath,
      theme
    ) VALUES (
      $badgeId,
      $order,
      $url,
      $localPath,
      $theme
    );
    `
  );

  db.transaction(() => {
    badges.forEach(badge => {
      const { id: badgeId } = badge;

      const oldLocalPaths = new Map<string, string>();
      for (const { url, localPath } of getImageFilesForBadge.all({ badgeId })) {
        if (localPath) {
          oldLocalPaths.set(url, localPath);
        }
      }

      insertBadge.run({
        id: badgeId,
        category: badge.category,
        name: badge.name,
        descriptionTemplate: badge.descriptionTemplate,
      });

      for (const [order, image] of badge.images.entries()) {
        for (const [theme, imageFile] of Object.entries(image)) {
          insertBadgeImageFile.run({
            badgeId,
            localPath:
              imageFile.localPath || oldLocalPaths.get(imageFile.url) || null,
            order,
            theme,
            url: imageFile.url,
          });
        }
      }
    });
  })();
}

async function badgeImageFileDownloaded(
  url: string,
  localPath: string
): Promise<void> {
  const db = getInstance();
  prepare<Query>(
    db,
    'UPDATE badgeImageFiles SET localPath = $localPath WHERE url = $url'
  ).run({ url, localPath });
}

async function getAllBadgeImageFileLocalPaths(): Promise<Set<string>> {
  const db = getInstance();
  const localPaths = db
    .prepare<EmptyQuery>(
      'SELECT localPath FROM badgeImageFiles WHERE localPath IS NOT NULL'
    )
    .pluck()
    .all();
  return new Set(localPaths);
}

// All data in database
async function removeAll(): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    db.exec(`
      DELETE FROM badges;
      DELETE FROM badgeImageFiles;
      DELETE FROM conversations;
      DELETE FROM identityKeys;
      DELETE FROM items;
      DELETE FROM messages;
      DELETE FROM preKeys;
      DELETE FROM senderKeys;
      DELETE FROM sessions;
      DELETE FROM signedPreKeys;
      DELETE FROM unprocessed;
      DELETE FROM attachment_downloads;
      DELETE FROM messages_fts;
      DELETE FROM stickers;
      DELETE FROM sticker_packs;
      DELETE FROM sticker_references;
      DELETE FROM jobs;
    `);
  })();
}

// Anything that isn't user-visible data
async function removeAllConfiguration(
  mode = RemoveAllConfiguration.Full
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    db.exec(
      `
      DELETE FROM identityKeys;
      DELETE FROM preKeys;
      DELETE FROM senderKeys;
      DELETE FROM sessions;
      DELETE FROM signedPreKeys;
      DELETE FROM unprocessed;
      DELETE FROM jobs;
      `
    );

    if (mode === RemoveAllConfiguration.Full) {
      db.exec(
        `
        DELETE FROM items;
        `
      );
    } else if (mode === RemoveAllConfiguration.Soft) {
      const itemIds: ReadonlyArray<string> = db
        .prepare<EmptyQuery>('SELECT id FROM items')
        .pluck(true)
        .all();

      const allowedSet = new Set<string>(STORAGE_UI_KEYS);
      for (const id of itemIds) {
        if (!allowedSet.has(id)) {
          removeById(db, 'items', id);
        }
      }
    } else {
      throw missingCaseError(mode);
    }

    db.exec(
      "UPDATE conversations SET json = json_remove(json, '$.senderKeyInfo');"
    );
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

async function getMessageServerGuidsForSpam(
  conversationId: string
): Promise<Array<string>> {
  const db = getInstance();

  // The server's maximum is 3, which is why you see `LIMIT 3` in this query. Note that we
  //   use `pluck` here to only get the first column!
  return db
    .prepare<Query>(
      `
      SELECT serverGuid
      FROM messages
      WHERE conversationId = $conversationId
      AND type = 'incoming'
      AND serverGuid IS NOT NULL
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 3;
      `
    )
    .pluck(true)
    .all({ conversationId });
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
    if (attachment.pending) {
      return;
    }

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
  const chunkSize = 500;

  const total = getMessageCountSync();
  logger.info(
    `removeKnownAttachments: About to iterate through ${total} messages`
  );

  let count = 0;

  for (const message of new TableIterator<MessageType>(db, 'messages')) {
    const externalFiles = getExternalFilesForMessage(message);
    forEach(externalFiles, file => {
      delete lookup[file];
    });
    count += 1;
  }

  logger.info(`removeKnownAttachments: Done processing ${count} messages`);

  let complete = false;
  count = 0;
  let id = '';

  const conversationTotal = await getConversationCount();
  logger.info(
    `removeKnownAttachments: About to iterate through ${conversationTotal} conversations`
  );

  const fetchConversations = db.prepare<Query>(
    `
      SELECT json FROM conversations
      WHERE id > $id
      ORDER BY id ASC
      LIMIT $chunkSize;
    `
  );

  while (!complete) {
    const rows = fetchConversations.all({
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

  logger.info(`removeKnownAttachments: Done processing ${count} conversations`);

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

  const total = await getStickerCount();
  logger.info(
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

  logger.info(`removeKnownStickers: Done processing ${count} stickers`);

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
  logger.info(
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

  logger.info(
    `removeKnownDraftAttachments: Done processing ${count} conversations`
  );

  return Object.keys(lookup);
}

async function getJobsInQueue(queueType: string): Promise<Array<StoredJob>> {
  const db = getInstance();

  return db
    .prepare<Query>(
      `
      SELECT id, timestamp, data
      FROM jobs
      WHERE queueType = $queueType
      ORDER BY timestamp;
      `
    )
    .all({ queueType })
    .map(row => ({
      id: row.id,
      queueType,
      timestamp: row.timestamp,
      data: isNotNil(row.data) ? JSON.parse(row.data) : undefined,
    }));
}

function insertJobSync(db: Database, job: Readonly<StoredJob>): void {
  db.prepare<Query>(
    `
      INSERT INTO jobs
      (id, queueType, timestamp, data)
      VALUES
      ($id, $queueType, $timestamp, $data);
    `
  ).run({
    id: job.id,
    queueType: job.queueType,
    timestamp: job.timestamp,
    data: isNotNil(job.data) ? JSON.stringify(job.data) : null,
  });
}

async function insertJob(job: Readonly<StoredJob>): Promise<void> {
  const db = getInstance();
  return insertJobSync(db, job);
}

async function deleteJob(id: string): Promise<void> {
  const db = getInstance();

  db.prepare<Query>('DELETE FROM jobs WHERE id = $id').run({ id });
}

async function processGroupCallRingRequest(
  ringId: bigint
): Promise<ProcessGroupCallRingRequestResult> {
  const db = getInstance();

  return db.transaction(() => {
    let result: ProcessGroupCallRingRequestResult;

    const wasRingPreviouslyCanceled = Boolean(
      db
        .prepare<Query>(
          `
          SELECT 1 FROM groupCallRings
          WHERE ringId = $ringId AND isActive = 0
          LIMIT 1;
          `
        )
        .pluck(true)
        .get({ ringId })
    );

    if (wasRingPreviouslyCanceled) {
      result = ProcessGroupCallRingRequestResult.RingWasPreviouslyCanceled;
    } else {
      const isThereAnotherActiveRing = Boolean(
        db
          .prepare<EmptyQuery>(
            `
            SELECT 1 FROM groupCallRings
            WHERE isActive = 1
            LIMIT 1;
            `
          )
          .pluck(true)
          .get()
      );
      if (isThereAnotherActiveRing) {
        result = ProcessGroupCallRingRequestResult.ThereIsAnotherActiveRing;
      } else {
        result = ProcessGroupCallRingRequestResult.ShouldRing;
      }

      db.prepare<Query>(
        `
        INSERT OR IGNORE INTO groupCallRings (ringId, isActive, createdAt)
        VALUES ($ringId, 1, $createdAt);
        `
      );
    }

    return result;
  })();
}

async function processGroupCallRingCancelation(ringId: bigint): Promise<void> {
  const db = getInstance();

  db.prepare<Query>(
    `
    INSERT INTO groupCallRings (ringId, isActive, createdAt)
    VALUES ($ringId, 0, $createdAt)
    ON CONFLICT (ringId) DO
    UPDATE SET isActive = 0;
    `
  ).run({ ringId, createdAt: Date.now() });
}

// This age, in milliseconds, should be longer than any group call ring duration. Beyond
//   that, it doesn't really matter what the value is.
const MAX_GROUP_CALL_RING_AGE = 30 * durations.MINUTE;

async function cleanExpiredGroupCallRings(): Promise<void> {
  const db = getInstance();

  db.prepare<Query>(
    `
    DELETE FROM groupCallRings
    WHERE createdAt < $expiredRingTime;
    `
  ).run({
    expiredRingTime: Date.now() - MAX_GROUP_CALL_RING_AGE,
  });
}

async function getMaxMessageCounter(): Promise<number | undefined> {
  const db = getInstance();

  return db
    .prepare<EmptyQuery>(
      `
    SELECT MAX(counter)
    FROM
      (
        SELECT MAX(received_at) AS counter FROM messages
        UNION
        SELECT MAX(timestamp) AS counter FROM unprocessed
      )
    `
    )
    .pluck()
    .get();
}

async function getStatisticsForLogging(): Promise<Record<string, string>> {
  const db = getInstance();
  const counts = await pProps({
    messageCount: getMessageCount(),
    conversationCount: getConversationCount(),
    sessionCount: getCountFromTable(db, 'sessions'),
    senderKeyCount: getCountFromTable(db, 'senderKeys'),
  });
  return mapValues(counts, formatCountForLogging);
}

async function updateAllConversationColors(
  conversationColor?: ConversationColorType,
  customColorData?: {
    id: string;
    value: CustomColorType;
  }
): Promise<void> {
  const db = getInstance();

  db.prepare<Query>(
    `
    UPDATE conversations
    SET json = JSON_PATCH(json, $patch);
    `
  ).run({
    patch: JSON.stringify({
      conversationColor: conversationColor || null,
      customColor: customColorData?.value || null,
      customColorId: customColorData?.id || null,
    }),
  });
}
