// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

import { join } from 'path';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import type { Database, Statement } from 'better-sqlite3';
import SQL from 'better-sqlite3';
import pProps from 'p-props';

import type { Dictionary } from 'lodash';
import {
  forEach,
  fromPairs,
  groupBy,
  isBoolean,
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
import { assert, assertSync, strictAssert } from '../util/assert';
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
  StoredAllItemsType,
  AttachmentDownloadJobType,
  ConversationMetricsType,
  ConversationType,
  DeleteSentProtoRecipientOptionsType,
  EmojiType,
  GetConversationRangeCenteredOnMessageResultType,
  GetUnreadByConversationAndMarkReadResultType,
  IdentityKeyIdType,
  StoredIdentityKeyType,
  InstalledStickerPackType,
  ItemKeyType,
  StoredItemType,
  ConversationMessageStatsType,
  MessageMetricsType,
  MessageType,
  MessageTypeUnhydrated,
  PreKeyIdType,
  ReactionResultType,
  StoredPreKeyType,
  ServerSearchResultMessageType,
  SenderKeyIdType,
  SenderKeyType,
  SentMessageDBType,
  SentMessagesType,
  SentProtoType,
  SentProtoWithMessageIdsType,
  SentRecipientsDBType,
  SentRecipientsType,
  ServerInterface,
  SessionIdType,
  SessionType,
  SignedPreKeyIdType,
  StoredSignedPreKeyType,
  StickerPackInfoType,
  StickerPackStatusType,
  StickerPackType,
  StickerType,
  StoryDistributionMemberType,
  StoryDistributionType,
  StoryDistributionWithMembersType,
  StoryReadType,
  UninstalledStickerPackType,
  UnprocessedType,
  UnprocessedUpdateType,
} from './Interface';
import { SeenStatus } from '../MessageSeenStatus';

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
  removePreKeysByUuid,
  removeAllPreKeys,
  getAllPreKeys,

  createOrUpdateSignedPreKey,
  getSignedPreKeyById,
  bulkAddSignedPreKeys,
  removeSignedPreKeyById,
  removeSignedPreKeysByUuid,
  removeAllSignedPreKeys,
  getAllSignedPreKeys,

  createOrUpdateItem,
  getItemById,
  removeItemById,
  removeAllItems,
  getAllItems,

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
  commitDecryptResult,
  bulkAddSessions,
  removeSessionById,
  removeSessionsByConversation,
  removeAllSessions,
  getAllSessions,

  eraseStorageServiceStateFromConversations,
  getConversationCount,
  saveConversation,
  saveConversations,
  getConversationById,
  updateConversation,
  updateConversations,
  removeConversation,
  _removeAllConversations,
  updateAllConversationColors,
  removeAllProfileKeyCredentials,

  getAllConversations,
  getAllConversationIds,
  getAllGroupsInvolvingUuid,

  searchMessages,
  searchMessagesInConversation,

  getMessageCount,
  getStoryCount,
  saveMessage,
  saveMessages,
  removeMessage,
  removeMessages,
  getUnreadByConversationAndMarkRead,
  getUnreadReactionsAndMarkRead,
  markReactionAsRead,
  addReaction,
  removeReactionFromConversation,
  _getAllReactions,
  _removeAllReactions,
  getMessageBySender,
  getMessageById,
  getMessagesById,
  _getAllMessages,
  _removeAllMessages,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getMessagesUnexpectedlyMissingExpirationStartTimestamp,
  getSoonestMessageExpiry,
  getNextTapToViewMessageTimestampToAgeOut,
  getTapToViewMessagesNeedingErase,
  getOlderMessagesByConversation,
  getOlderStories,
  getNewerMessagesByConversation,
  getTotalUnreadForConversation,
  getMessageMetricsForConversation,
  getConversationRangeCenteredOnMessage,
  getConversationMessageStats,
  getLastConversationMessage,
  hasGroupCallHistoryMessage,
  migrateConversationMessages,

  getUnprocessedCount,
  getAllUnprocessedAndIncrementAttempts,
  updateUnprocessedWithData,
  updateUnprocessedsWithData,
  getUnprocessedById,
  removeUnprocessed,
  removeAllUnprocessed,

  getAttachmentDownloadJobById,
  getNextAttachmentDownloadJobs,
  saveAttachmentDownloadJob,
  resetAttachmentDownloadPending,
  setAttachmentDownloadJobPending,
  removeAttachmentDownloadJob,
  removeAllAttachmentDownloadJobs,

  createOrUpdateStickerPack,
  updateStickerPackStatus,
  updateStickerPackInfo,
  createOrUpdateSticker,
  updateStickerLastUsed,
  addStickerPackReference,
  deleteStickerPackReference,
  getStickerCount,
  deleteStickerPack,
  getAllStickerPacks,
  addUninstalledStickerPack,
  removeUninstalledStickerPack,
  getInstalledStickerPacks,
  getUninstalledStickerPacks,
  installStickerPack,
  uninstallStickerPack,
  getStickerPackInfo,
  getAllStickers,
  getRecentStickers,
  clearAllErrorStickerPackAttempts,

  updateEmojiUsage,
  getRecentEmojis,

  getAllBadges,
  updateOrCreateBadges,
  badgeImageFileDownloaded,

  _getAllStoryDistributions,
  _getAllStoryDistributionMembers,
  _deleteAllStoryDistributions,
  createNewStoryDistribution,
  getAllStoryDistributionsWithMembers,
  getStoryDistributionWithMembers,
  modifyStoryDistribution,
  modifyStoryDistributionMembers,
  modifyStoryDistributionWithMembers,
  deleteStoryDistribution,

  _getAllStoryReads,
  _deleteAllStoryReads,
  addNewStoryRead,
  getLastStoryReadsForAuthor,
  countStoryReadsByConversation,

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
  db.pragma('fullfsync = ON');
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
  mkdirp.sync(dbDir);

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

  logger.warn('removeDB: Removing all database files');
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
async function createOrUpdateIdentityKey(
  data: StoredIdentityKeyType
): Promise<void> {
  return createOrUpdate(getInstance(), IDENTITY_KEYS_TABLE, data);
}
async function getIdentityKeyById(
  id: IdentityKeyIdType
): Promise<StoredIdentityKeyType | undefined> {
  return getById(getInstance(), IDENTITY_KEYS_TABLE, id);
}
async function bulkAddIdentityKeys(
  array: Array<StoredIdentityKeyType>
): Promise<void> {
  return bulkAdd(getInstance(), IDENTITY_KEYS_TABLE, array);
}
async function removeIdentityKeyById(id: IdentityKeyIdType): Promise<void> {
  return removeById(getInstance(), IDENTITY_KEYS_TABLE, id);
}
async function removeAllIdentityKeys(): Promise<void> {
  return removeAllFromTable(getInstance(), IDENTITY_KEYS_TABLE);
}
async function getAllIdentityKeys(): Promise<Array<StoredIdentityKeyType>> {
  return getAllFromTable(getInstance(), IDENTITY_KEYS_TABLE);
}

const PRE_KEYS_TABLE = 'preKeys';
async function createOrUpdatePreKey(data: StoredPreKeyType): Promise<void> {
  return createOrUpdate(getInstance(), PRE_KEYS_TABLE, data);
}
async function getPreKeyById(
  id: PreKeyIdType
): Promise<StoredPreKeyType | undefined> {
  return getById(getInstance(), PRE_KEYS_TABLE, id);
}
async function bulkAddPreKeys(array: Array<StoredPreKeyType>): Promise<void> {
  return bulkAdd(getInstance(), PRE_KEYS_TABLE, array);
}
async function removePreKeyById(id: PreKeyIdType): Promise<void> {
  return removeById(getInstance(), PRE_KEYS_TABLE, id);
}
async function removePreKeysByUuid(uuid: UUIDStringType): Promise<void> {
  const db = getInstance();
  db.prepare<Query>('DELETE FROM preKeys WHERE ourUuid IS $uuid;').run({
    uuid,
  });
}
async function removeAllPreKeys(): Promise<void> {
  return removeAllFromTable(getInstance(), PRE_KEYS_TABLE);
}
async function getAllPreKeys(): Promise<Array<StoredPreKeyType>> {
  return getAllFromTable(getInstance(), PRE_KEYS_TABLE);
}

const SIGNED_PRE_KEYS_TABLE = 'signedPreKeys';
async function createOrUpdateSignedPreKey(
  data: StoredSignedPreKeyType
): Promise<void> {
  return createOrUpdate(getInstance(), SIGNED_PRE_KEYS_TABLE, data);
}
async function getSignedPreKeyById(
  id: SignedPreKeyIdType
): Promise<StoredSignedPreKeyType | undefined> {
  return getById(getInstance(), SIGNED_PRE_KEYS_TABLE, id);
}
async function bulkAddSignedPreKeys(
  array: Array<StoredSignedPreKeyType>
): Promise<void> {
  return bulkAdd(getInstance(), SIGNED_PRE_KEYS_TABLE, array);
}
async function removeSignedPreKeyById(id: SignedPreKeyIdType): Promise<void> {
  return removeById(getInstance(), SIGNED_PRE_KEYS_TABLE, id);
}
async function removeSignedPreKeysByUuid(uuid: UUIDStringType): Promise<void> {
  const db = getInstance();
  db.prepare<Query>('DELETE FROM signedPreKeys WHERE ourUuid IS $uuid;').run({
    uuid,
  });
}
async function removeAllSignedPreKeys(): Promise<void> {
  return removeAllFromTable(getInstance(), SIGNED_PRE_KEYS_TABLE);
}
async function getAllSignedPreKeys(): Promise<Array<StoredSignedPreKeyType>> {
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
  data: StoredItemType<K>
): Promise<void> {
  return createOrUpdate(getInstance(), ITEMS_TABLE, data);
}
async function getItemById<K extends ItemKeyType>(
  id: K
): Promise<StoredItemType<K> | undefined> {
  return getById(getInstance(), ITEMS_TABLE, id);
}
async function getAllItems(): Promise<StoredAllItemsType> {
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

  return result as unknown as StoredAllItemsType;
}
async function removeItemById(id: ItemKeyType): Promise<void> {
  return removeById(getInstance(), ITEMS_TABLE, id);
}
async function removeAllItems(): Promise<void> {
  return removeAllFromTable(getInstance(), ITEMS_TABLE);
}

async function createOrUpdateSenderKey(key: SenderKeyType): Promise<void> {
  createOrUpdateSenderKeySync(key);
}

function createOrUpdateSenderKeySync(key: SenderKeyType): void {
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
        timestamp,
        urgent
      ) VALUES (
        $contentHint,
        $proto,
        $timestamp,
        $urgent
      );
      `
    ).run({
      ...proto,
      urgent: proto.urgent ? 1 : 0,
    });
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
    urgent: isNumber(row.urgent) ? Boolean(row.urgent) : true,
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

  return rows.map(row => ({
    ...row,
    urgent: isNumber(row.urgent) ? Boolean(row.urgent) : true,
  }));
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

async function commitDecryptResult({
  senderKeys,
  sessions,
  unprocessed,
}: {
  senderKeys: Array<SenderKeyType>;
  sessions: Array<SessionType>;
  unprocessed: Array<UnprocessedType>;
}): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const item of senderKeys) {
      assertSync(createOrUpdateSenderKeySync(item));
    }

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

async function _removeAllConversations(): Promise<void> {
  const db = getInstance();
  db.prepare<EmptyQuery>('DELETE from conversations;').run();
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

async function searchMessages(
  query: string,
  params: { limit?: number; conversationId?: string } = {}
): Promise<Array<ServerSearchResultMessageType>> {
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
): Promise<Array<ServerSearchResultMessageType>> {
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

async function getStoryCount(conversationId: string): Promise<number> {
  const db = getInstance();
  return db
    .prepare<Query>(
      `
        SELECT count(*)
        FROM messages
        WHERE conversationId = $conversationId AND isStory = 1;
        `
    )
    .pluck()
    .get({ conversationId });
}

async function getMessageCount(conversationId?: string): Promise<number> {
  return getMessageCountSync(conversationId);
}

function hasUserInitiatedMessages(conversationId: string): boolean {
  const db = getInstance();

  const row: { count: number } = db
    .prepare<Query>(
      `
      SELECT COUNT(*) as count FROM
        (
          SELECT 1 FROM messages
          WHERE
            conversationId = $conversationId AND
            isUserInitiatedMessage = 1
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
    alreadyInTransaction?: boolean;
    db?: Database;
    forceSave?: boolean;
    jobToInsert?: StoredJob;
    ourUuid: UUIDStringType;
  }
): string {
  const {
    alreadyInTransaction,
    db = getInstance(),
    forceSave,
    jobToInsert,
    ourUuid,
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
    groupV2Change,
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
    storyId,
    type,
    readStatus,
    expireTimer,
    expirationStartTimestamp,
    attachments,
  } = data;
  let { seenStatus } = data;

  if (attachments) {
    strictAssert(
      attachments.every(attachment => !attachment.data),
      'Attempting to save a hydrated message'
    );
  }

  if (readStatus === ReadStatus.Unread && seenStatus !== SeenStatus.Unseen) {
    log.warn(
      `saveMessage: Message ${id}/${type} is unread but had seenStatus=${seenStatus}. Forcing to UnseenStatus.Unseen.`
    );

    // eslint-disable-next-line no-param-reassign
    data = {
      ...data,
      seenStatus: SeenStatus.Unseen,
    };
    seenStatus = SeenStatus.Unseen;
  }

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
    isChangeCreatedByUs: groupV2Change?.from === ourUuid ? 1 : 0,
    isErased: isErased ? 1 : 0,
    isViewOnce: isViewOnce ? 1 : 0,
    received_at: received_at || null,
    schemaVersion: schemaVersion || 0,
    serverGuid: serverGuid || null,
    sent_at: sent_at || null,
    source: source || null,
    sourceUuid: sourceUuid || null,
    sourceDevice: sourceDevice || null,
    storyId: storyId || null,
    type: type || null,
    readStatus: readStatus ?? null,
    seenStatus: seenStatus ?? SeenStatus.NotApplicable,
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
        isChangeCreatedByUs = $isChangeCreatedByUs,
        isErased = $isErased,
        isViewOnce = $isViewOnce,
        received_at = $received_at,
        schemaVersion = $schemaVersion,
        serverGuid = $serverGuid,
        sent_at = $sent_at,
        source = $source,
        sourceUuid = $sourceUuid,
        sourceDevice = $sourceDevice,
        storyId = $storyId,
        type = $type,
        readStatus = $readStatus,
        seenStatus = $seenStatus
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
      isChangeCreatedByUs,
      isErased,
      isViewOnce,
      received_at,
      schemaVersion,
      serverGuid,
      sent_at,
      source,
      sourceUuid,
      sourceDevice,
      storyId,
      type,
      readStatus,
      seenStatus
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
      $isChangeCreatedByUs,
      $isErased,
      $isViewOnce,
      $received_at,
      $schemaVersion,
      $serverGuid,
      $sent_at,
      $source,
      $sourceUuid,
      $sourceDevice,
      $storyId,
      $type,
      $readStatus,
      $seenStatus
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
  options: {
    jobToInsert?: StoredJob;
    forceSave?: boolean;
    alreadyInTransaction?: boolean;
    ourUuid: UUIDStringType;
  }
): Promise<string> {
  return saveMessageSync(data, options);
}

async function saveMessages(
  arrayOfMessages: ReadonlyArray<MessageType>,
  options: { forceSave?: boolean; ourUuid: UUIDStringType }
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    for (const message of arrayOfMessages) {
      assertSync(
        saveMessageSync(message, { ...options, alreadyInTransaction: true })
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
  return getMessageByIdSync(db, id);
}

export function getMessageByIdSync(
  db: Database,
  id: string
): MessageType | undefined {
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
async function _removeAllMessages(): Promise<void> {
  const db = getInstance();
  db.prepare<EmptyQuery>('DELETE from messages;').run();
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
  sourceUuid: UUIDStringType;
  sourceDevice: number;
  sent_at: number;
}): Promise<MessageType | undefined> {
  const db = getInstance();
  const rows: JSONRows = prepare(
    db,
    `
    SELECT json FROM messages WHERE
      (source = $source OR sourceUuid = $sourceUuid) AND
      sourceDevice = $sourceDevice AND
      sent_at = $sent_at
    LIMIT 2;
    `
  ).all({
    source,
    sourceUuid,
    sourceDevice,
    sent_at,
  });

  if (rows.length > 1) {
    log.warn('getMessageBySender: More than one message found for', {
      sent_at,
      source,
      sourceUuid,
      sourceDevice,
    });
  }

  if (rows.length < 1) {
    return undefined;
  }

  return jsonToObject(rows[0].json);
}

export function _storyIdPredicate(
  storyId: string | undefined,
  isGroup?: boolean
): string {
  if (!isGroup && storyId === undefined) {
    // We could use 'TRUE' here, but it is better to require `$storyId`
    // parameter
    return '$storyId IS NULL';
  }

  return 'storyId IS $storyId';
}

async function getUnreadByConversationAndMarkRead({
  conversationId,
  isGroup,
  newestUnreadAt,
  storyId,
  readAt,
}: {
  conversationId: string;
  isGroup?: boolean;
  newestUnreadAt: number;
  storyId?: UUIDStringType;
  readAt?: number;
}): Promise<GetUnreadByConversationAndMarkReadResultType> {
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
        conversationId = $conversationId AND
        (${_storyIdPredicate(storyId, isGroup)}) AND
        isStory IS 0 AND
        type IS 'incoming' AND
        (
          expirationStartTimestamp IS NULL OR
          expirationStartTimestamp > $expirationStartTimestamp
        ) AND
        expireTimer > 0 AND
        received_at <= $newestUnreadAt;
      `
    ).run({
      conversationId,
      expirationStartTimestamp,
      jsonPatch: JSON.stringify({ expirationStartTimestamp }),
      newestUnreadAt,
      storyId: storyId || null,
    });

    const rows = db
      .prepare<Query>(
        `
        SELECT id, json FROM messages
        WHERE
          conversationId = $conversationId AND
          seenStatus = ${SeenStatus.Unseen} AND
          isStory = 0 AND
          (${_storyIdPredicate(storyId, isGroup)}) AND
          received_at <= $newestUnreadAt
        ORDER BY received_at DESC, sent_at DESC;
        `
      )
      .all({
        conversationId,
        newestUnreadAt,
        storyId: storyId || null,
      });

    db.prepare<Query>(
      `
        UPDATE messages
        SET
          readStatus = ${ReadStatus.Read},
          seenStatus = ${SeenStatus.Seen},
          json = json_patch(json, $jsonPatch)
        WHERE
          conversationId = $conversationId AND
          seenStatus = ${SeenStatus.Unseen} AND
          isStory = 0 AND
          (${_storyIdPredicate(storyId, isGroup)}) AND
          received_at <= $newestUnreadAt;
        `
    ).run({
      conversationId,
      jsonPatch: JSON.stringify({
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
      }),
      newestUnreadAt,
      storyId: storyId || null,
    });

    return rows.map(row => {
      const json = jsonToObject<MessageType>(row.json);
      return {
        originalReadStatus: json.readStatus,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
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

async function getUnreadReactionsAndMarkRead({
  conversationId,
  newestUnreadAt,
  storyId,
}: {
  conversationId: string;
  newestUnreadAt: number;
  storyId?: UUIDStringType;
}): Promise<Array<ReactionResultType>> {
  const db = getInstance();

  return db.transaction(() => {
    const unreadMessages: Array<ReactionResultType> = db
      .prepare<Query>(
        `
        SELECT reactions.rowid, targetAuthorUuid, targetTimestamp, messageId
        FROM reactions
        JOIN messages on messages.id IS reactions.messageId
        WHERE
          unread > 0 AND
          messages.conversationId IS $conversationId AND
          messages.received_at <= $newestUnreadAt AND
          messages.storyId IS $storyId
        ORDER BY messageReceivedAt DESC;
      `
      )
      .all({
        conversationId,
        newestUnreadAt,
        storyId: storyId || null,
      });

    const idsToUpdate = unreadMessages.map(item => item.rowid);
    batchMultiVarQuery(db, idsToUpdate, (ids: Array<number>): void => {
      db.prepare<ArrayQuery>(
        `
        UPDATE reactions SET
        unread = 0 WHERE rowid IN ( ${ids.map(() => '?').join(', ')} );
        `
      ).run(ids);
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
async function _removeAllReactions(): Promise<void> {
  const db = getInstance();
  db.prepare<EmptyQuery>('DELETE from reactions;').run();
}

async function getOlderMessagesByConversation(
  conversationId: string,
  options: {
    isGroup: boolean;
    limit?: number;
    messageId?: string;
    receivedAt?: number;
    sentAt?: number;
    storyId: string | undefined;
  }
): Promise<Array<MessageTypeUnhydrated>> {
  return getOlderMessagesByConversationSync(conversationId, options);
}
function getOlderMessagesByConversationSync(
  conversationId: string,
  {
    isGroup,
    limit = 100,
    messageId,
    receivedAt = Number.MAX_VALUE,
    sentAt = Number.MAX_VALUE,
    storyId,
  }: {
    isGroup: boolean;
    limit?: number;
    messageId?: string;
    receivedAt?: number;
    sentAt?: number;
    storyId: string | undefined;
  }
): Array<MessageTypeUnhydrated> {
  const db = getInstance();

  return db
    .prepare<Query>(
      `
      SELECT json FROM messages WHERE
        conversationId = $conversationId AND
        ($messageId IS NULL OR id IS NOT $messageId) AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, isGroup)}) AND
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
      limit,
      messageId: messageId || null,
      received_at: receivedAt,
      sent_at: sentAt,
      storyId: storyId || null,
    })
    .reverse();
}

async function getOlderStories({
  conversationId,
  limit = 9999,
  receivedAt = Number.MAX_VALUE,
  sentAt,
  sourceUuid,
}: {
  conversationId?: string;
  limit?: number;
  receivedAt?: number;
  sentAt?: number;
  sourceUuid?: UUIDStringType;
}): Promise<Array<MessageType>> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json
      FROM messages
      WHERE
        type IS 'story' AND
        ($conversationId IS NULL OR conversationId IS $conversationId) AND
        ($sourceUuid IS NULL OR sourceUuid IS $sourceUuid) AND
        (received_at < $receivedAt
          OR (received_at IS $receivedAt AND sent_at < $sentAt)
        )
      ORDER BY received_at ASC, sent_at ASC
      LIMIT $limit;
      `
    )
    .all({
      conversationId: conversationId || null,
      receivedAt,
      sentAt: sentAt || null,
      sourceUuid: sourceUuid || null,
      limit,
    });

  return rows.map(row => jsonToObject(row.json));
}

async function getNewerMessagesByConversation(
  conversationId: string,
  options: {
    isGroup: boolean;
    limit?: number;
    receivedAt?: number;
    sentAt?: number;
    storyId: UUIDStringType | undefined;
  }
): Promise<Array<MessageTypeUnhydrated>> {
  return getNewerMessagesByConversationSync(conversationId, options);
}
function getNewerMessagesByConversationSync(
  conversationId: string,
  {
    isGroup,
    limit = 100,
    receivedAt = 0,
    sentAt = 0,
    storyId,
  }: {
    isGroup: boolean;
    limit?: number;
    receivedAt?: number;
    sentAt?: number;
    storyId: UUIDStringType | undefined;
  }
): Array<MessageTypeUnhydrated> {
  const db = getInstance();
  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json FROM messages WHERE
        conversationId = $conversationId AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, isGroup)}) AND
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
      limit,
      received_at: receivedAt,
      sent_at: sentAt,
      storyId: storyId || null,
    });

  return rows;
}
function getOldestMessageForConversation(
  conversationId: string,
  storyId?: UUIDStringType,
  isGroup?: boolean
): MessageMetricsType | undefined {
  const db = getInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT * FROM messages WHERE
        conversationId = $conversationId AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, isGroup)})
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
      `
    )
    .get({
      conversationId,
      storyId: storyId || null,
    });

  if (!row) {
    return undefined;
  }

  return row;
}
function getNewestMessageForConversation(
  conversationId: string,
  storyId?: UUIDStringType,
  isGroup?: boolean
): MessageMetricsType | undefined {
  const db = getInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT * FROM messages WHERE
        conversationId = $conversationId AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, isGroup)})
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
      `
    )
    .get({
      conversationId,
      storyId: storyId || null,
    });

  if (!row) {
    return undefined;
  }

  return row;
}

function getLastConversationActivity({
  conversationId,
  isGroup,
  ourUuid,
}: {
  conversationId: string;
  isGroup?: boolean;
  ourUuid: UUIDStringType;
}): MessageType | undefined {
  const db = getInstance();
  const row = prepare(
    db,
    `
      SELECT json FROM messages
      WHERE
        conversationId = $conversationId AND
        shouldAffectActivity IS 1 AND
        isTimerChangeFromSync IS 0 AND
        ${isGroup ? 'storyId IS NULL AND' : ''}
        isGroupLeaveEventFromOther IS 0
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
  isGroup,
}: {
  conversationId: string;
  isGroup?: boolean;
}): MessageType | undefined {
  const db = getInstance();
  const row = prepare(
    db,
    `
      SELECT json FROM messages
      WHERE
        conversationId = $conversationId AND
        shouldAffectPreview IS 1 AND
        isGroupLeaveEventFromOther IS 0 AND
        ${isGroup ? 'storyId IS NULL AND' : ''}
        (
          expiresAt IS NULL
          OR
          expiresAt > $now
        )
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
      `
  ).get({
    conversationId,
    now: Date.now(),
  });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}

async function getConversationMessageStats({
  conversationId,
  isGroup,
  ourUuid,
}: {
  conversationId: string;
  isGroup?: boolean;
  ourUuid: UUIDStringType;
}): Promise<ConversationMessageStatsType> {
  const db = getInstance();

  return db.transaction(() => {
    return {
      activity: getLastConversationActivity({
        conversationId,
        isGroup,
        ourUuid,
      }),
      preview: getLastConversationPreview({ conversationId, isGroup }),
      hasUserInitiatedMessages: hasUserInitiatedMessages(conversationId),
    };
  })();
}

async function getLastConversationMessage({
  conversationId,
}: {
  conversationId: string;
}): Promise<MessageType | undefined> {
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

  return jsonToObject(row.json);
}

function getOldestUnseenMessageForConversation(
  conversationId: string,
  storyId?: UUIDStringType,
  isGroup?: boolean
): MessageMetricsType | undefined {
  const db = getInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT * FROM messages WHERE
        conversationId = $conversationId AND
        seenStatus = ${SeenStatus.Unseen} AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, isGroup)})
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
      `
    )
    .get({
      conversationId,
      storyId: storyId || null,
    });

  if (!row) {
    return undefined;
  }

  return row;
}

async function getTotalUnreadForConversation(
  conversationId: string,
  options: {
    storyId: UUIDStringType | undefined;
    isGroup: boolean;
  }
): Promise<number> {
  return getTotalUnreadForConversationSync(conversationId, options);
}
function getTotalUnreadForConversationSync(
  conversationId: string,
  {
    storyId,
    isGroup,
  }: {
    storyId: UUIDStringType | undefined;
    isGroup: boolean;
  }
): number {
  const db = getInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT count(id)
      FROM messages
      WHERE
        conversationId = $conversationId AND
        readStatus = ${ReadStatus.Unread} AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, isGroup)})
      `
    )
    .get({
      conversationId,
      storyId: storyId || null,
    });

  if (!row) {
    throw new Error('getTotalUnreadForConversation: Unable to get count');
  }

  return row['count(id)'];
}
function getTotalUnseenForConversationSync(
  conversationId: string,
  storyId?: UUIDStringType,
  isGroup?: boolean
): number {
  const db = getInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT count(id)
      FROM messages
      WHERE
        conversationId = $conversationId AND
        seenStatus = ${SeenStatus.Unseen} AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, isGroup)})
      `
    )
    .get({
      conversationId,
      storyId: storyId || null,
    });

  if (!row) {
    throw new Error('getTotalUnseenForConversationSync: Unable to get count');
  }

  return row['count(id)'];
}

async function getMessageMetricsForConversation(
  conversationId: string,
  storyId?: UUIDStringType,
  isGroup?: boolean
): Promise<ConversationMetricsType> {
  return getMessageMetricsForConversationSync(conversationId, storyId, isGroup);
}
function getMessageMetricsForConversationSync(
  conversationId: string,
  storyId?: UUIDStringType,
  isGroup?: boolean
): ConversationMetricsType {
  const oldest = getOldestMessageForConversation(
    conversationId,
    storyId,
    isGroup
  );
  const newest = getNewestMessageForConversation(
    conversationId,
    storyId,
    isGroup
  );
  const oldestUnseen = getOldestUnseenMessageForConversation(
    conversationId,
    storyId,
    isGroup
  );
  const totalUnseen = getTotalUnseenForConversationSync(
    conversationId,
    storyId,
    isGroup
  );

  return {
    oldest: oldest ? pick(oldest, ['received_at', 'sent_at', 'id']) : undefined,
    newest: newest ? pick(newest, ['received_at', 'sent_at', 'id']) : undefined,
    oldestUnseen: oldestUnseen
      ? pick(oldestUnseen, ['received_at', 'sent_at', 'id'])
      : undefined,
    totalUnseen,
  };
}

async function getConversationRangeCenteredOnMessage({
  conversationId,
  isGroup,
  limit,
  messageId,
  receivedAt,
  sentAt,
  storyId,
}: {
  conversationId: string;
  isGroup: boolean;
  limit?: number;
  messageId: string;
  receivedAt: number;
  sentAt?: number;
  storyId: UUIDStringType | undefined;
}): Promise<
  GetConversationRangeCenteredOnMessageResultType<MessageTypeUnhydrated>
> {
  const db = getInstance();

  return db.transaction(() => {
    return {
      older: getOlderMessagesByConversationSync(conversationId, {
        isGroup,
        limit,
        messageId,
        receivedAt,
        sentAt,
        storyId,
      }),
      newer: getNewerMessagesByConversationSync(conversationId, {
        isGroup,
        limit,
        receivedAt,
        sentAt,
        storyId,
      }),
      metrics: getMessageMetricsForConversationSync(
        conversationId,
        storyId,
        isGroup
      ),
    };
  })();
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
    receivedAtCounter,
    version,
    attempts,
    envelope,
    source,
    sourceUuid,
    sourceDevice,
    serverGuid,
    serverTimestamp,
    decrypted,
    urgent,
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
      receivedAtCounter,
      version,
      attempts,
      envelope,
      source,
      sourceUuid,
      sourceDevice,
      serverGuid,
      serverTimestamp,
      decrypted,
      urgent
    ) values (
      $id,
      $timestamp,
      $receivedAtCounter,
      $version,
      $attempts,
      $envelope,
      $source,
      $sourceUuid,
      $sourceDevice,
      $serverGuid,
      $serverTimestamp,
      $decrypted,
      $urgent
    );
    `
  ).run({
    id,
    timestamp,
    receivedAtCounter: receivedAtCounter ?? null,
    version,
    attempts,
    envelope: envelope || null,
    source: source || null,
    sourceUuid: sourceUuid || null,
    sourceDevice: sourceDevice || null,
    serverGuid: serverGuid || null,
    serverTimestamp: serverTimestamp || null,
    decrypted: decrypted || null,
    urgent: urgent || !isBoolean(urgent) ? 1 : 0,
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

  return {
    ...row,
    urgent: isNumber(row.urgent) ? Boolean(row.urgent) : true,
  };
}

async function getUnprocessedCount(): Promise<number> {
  return getCountFromTable(getInstance(), 'unprocessed');
}

async function getAllUnprocessedAndIncrementAttempts(): Promise<
  Array<UnprocessedType>
> {
  const db = getInstance();

  return db.transaction(() => {
    const { changes: deletedStaleCount } = db
      .prepare<Query>('DELETE FROM unprocessed WHERE timestamp < $monthAgo')
      .run({
        monthAgo: Date.now() - durations.MONTH,
      });

    if (deletedStaleCount !== 0) {
      logger.warn(
        'getAllUnprocessedAndIncrementAttempts: ' +
          `deleting ${deletedStaleCount} old unprocessed envelopes`
      );
    }

    db.prepare<EmptyQuery>(
      `
        UPDATE unprocessed
        SET attempts = attempts + 1
      `
    ).run();

    const { changes: deletedInvalidCount } = db
      .prepare<Query>(
        `
          DELETE FROM unprocessed
          WHERE attempts >= $MAX_UNPROCESSED_ATTEMPTS
        `
      )
      .run({ MAX_UNPROCESSED_ATTEMPTS });

    if (deletedInvalidCount !== 0) {
      logger.warn(
        'getAllUnprocessedAndIncrementAttempts: ' +
          `deleting ${deletedInvalidCount} invalid unprocessed envelopes`
      );
    }

    return db
      .prepare<EmptyQuery>(
        `
          SELECT *
          FROM unprocessed
          ORDER BY receivedAtCounter ASC;
        `
      )
      .all()
      .map(row => ({
        ...row,
        urgent: isNumber(row.urgent) ? Boolean(row.urgent) : true,
      }));
  })();
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

  // This can happen normally due to flushing of `cacheRemoveBatcher` in
  // MessageReceiver.
  if (!id.length) {
    return;
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
async function getAttachmentDownloadJobById(
  id: string
): Promise<AttachmentDownloadJobType | undefined> {
  return getById(getInstance(), ATTACHMENT_DOWNLOADS_TABLE, id);
}
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
    storageID,
    storageVersion,
    storageUnknownFields,
    storageNeedsSync,
  } = pack;
  if (!id) {
    throw new Error(
      'createOrUpdateStickerPack: Provided data did not have a truthy id'
    );
  }

  let { position } = pack;

  // Assign default position
  if (!isNumber(position)) {
    position = db
      .prepare<EmptyQuery>(
        `
        SELECT IFNULL(MAX(position) + 1, 0)
        FROM sticker_packs
        `
      )
      .pluck()
      .get();
  }

  const row = db
    .prepare<Query>(
      `
      SELECT id
      FROM sticker_packs
      WHERE id = $id;
      `
    )
    .get({ id });
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
    position: position ?? 0,
    storageID: storageID ?? null,
    storageVersion: storageVersion ?? null,
    storageUnknownFields: storageUnknownFields ?? null,
    storageNeedsSync: storageNeedsSync ? 1 : 0,
  };

  if (row) {
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
        title = $title,
        position = $position,
        storageID = $storageID,
        storageVersion = $storageVersion,
        storageUnknownFields = $storageUnknownFields,
        storageNeedsSync = $storageNeedsSync
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
      title,
      position,
      storageID,
      storageVersion,
      storageUnknownFields,
      storageNeedsSync
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
      $title,
      $position,
      $storageID,
      $storageVersion,
      $storageUnknownFields,
      $storageNeedsSync
    )
    `
  ).run(payload);
}
function updateStickerPackStatusSync(
  id: string,
  status: StickerPackStatusType,
  options?: { timestamp: number }
): void {
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
async function updateStickerPackStatus(
  id: string,
  status: StickerPackStatusType,
  options?: { timestamp: number }
): Promise<void> {
  return updateStickerPackStatusSync(id, status, options);
}
async function updateStickerPackInfo({
  id,
  storageID,
  storageVersion,
  storageUnknownFields,
  storageNeedsSync,
  uninstalledAt,
}: StickerPackInfoType): Promise<void> {
  const db = getInstance();

  if (uninstalledAt) {
    db.prepare<Query>(
      `
      UPDATE uninstalled_sticker_packs
      SET
        storageID = $storageID,
        storageVersion = $storageVersion,
        storageUnknownFields = $storageUnknownFields,
        storageNeedsSync = $storageNeedsSync
      WHERE id = $id;
      `
    ).run({
      id,
      storageID: storageID ?? null,
      storageVersion: storageVersion ?? null,
      storageUnknownFields: storageUnknownFields ?? null,
      storageNeedsSync: storageNeedsSync ? 1 : 0,
    });
  } else {
    db.prepare<Query>(
      `
      UPDATE sticker_packs
      SET
        storageID = $storageID,
        storageVersion = $storageVersion,
        storageUnknownFields = $storageUnknownFields,
        storageNeedsSync = $storageNeedsSync
      WHERE id = $id;
      `
    ).run({
      id,
      storageID: storageID ?? null,
      storageVersion: storageVersion ?? null,
      storageUnknownFields: storageUnknownFields ?? null,
      storageNeedsSync: storageNeedsSync ? 1 : 0,
    });
  }
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
      ORDER BY position ASC, id ASC
      `
    )
    .all();

  return rows || [];
}
function addUninstalledStickerPackSync(pack: UninstalledStickerPackType): void {
  const db = getInstance();

  db.prepare<Query>(
    `
        INSERT OR REPLACE INTO uninstalled_sticker_packs
        (
          id, uninstalledAt, storageID, storageVersion, storageUnknownFields,
          storageNeedsSync
        )
        VALUES
        (
          $id, $uninstalledAt, $storageID, $storageVersion, $unknownFields,
          $storageNeedsSync
        )
      `
  ).run({
    id: pack.id,
    uninstalledAt: pack.uninstalledAt,
    storageID: pack.storageID ?? null,
    storageVersion: pack.storageVersion ?? null,
    unknownFields: pack.storageUnknownFields ?? null,
    storageNeedsSync: pack.storageNeedsSync ? 1 : 0,
  });
}
async function addUninstalledStickerPack(
  pack: UninstalledStickerPackType
): Promise<void> {
  return addUninstalledStickerPackSync(pack);
}
function removeUninstalledStickerPackSync(packId: string): void {
  const db = getInstance();

  db.prepare<Query>(
    'DELETE FROM uninstalled_sticker_packs WHERE id IS $id'
  ).run({ id: packId });
}
async function removeUninstalledStickerPack(packId: string): Promise<void> {
  return removeUninstalledStickerPackSync(packId);
}
async function getUninstalledStickerPacks(): Promise<
  Array<UninstalledStickerPackType>
> {
  const db = getInstance();

  const rows = db
    .prepare<EmptyQuery>(
      'SELECT * FROM uninstalled_sticker_packs ORDER BY id ASC'
    )
    .all();

  return rows || [];
}
async function getInstalledStickerPacks(): Promise<Array<StickerPackType>> {
  const db = getInstance();

  // If sticker pack has a storageID - it is being downloaded and about to be
  // installed so we better sync it back to storage service if asked.
  const rows = db
    .prepare<EmptyQuery>(
      `
      SELECT *
      FROM sticker_packs
      WHERE
        status IS "installed" OR
        storageID IS NOT NULL
      ORDER BY id ASC
      `
    )
    .all();

  return rows || [];
}
async function getStickerPackInfo(
  packId: string
): Promise<StickerPackInfoType | undefined> {
  const db = getInstance();

  return db.transaction(() => {
    const uninstalled = db
      .prepare<Query>(
        `
        SELECT * FROM uninstalled_sticker_packs
        WHERE id IS $packId
        `
      )
      .get({ packId });
    if (uninstalled) {
      return uninstalled as UninstalledStickerPackType;
    }

    const installed = db
      .prepare<Query>(
        `
        SELECT
          id, key, position, storageID, storageVersion, storageUnknownFields
        FROM sticker_packs
        WHERE id IS $packId
        `
      )
      .get({ packId });
    if (installed) {
      return installed as InstalledStickerPackType;
    }

    return undefined;
  })();
}
async function installStickerPack(
  packId: string,
  timestamp: number
): Promise<void> {
  const db = getInstance();
  return db.transaction(() => {
    const status = 'installed';
    updateStickerPackStatusSync(packId, status, { timestamp });

    removeUninstalledStickerPackSync(packId);
  })();
}
async function uninstallStickerPack(
  packId: string,
  timestamp: number
): Promise<void> {
  const db = getInstance();
  return db.transaction(() => {
    const status = 'downloaded';
    updateStickerPackStatusSync(packId, status);

    db.prepare<Query>(
      `
      UPDATE sticker_packs SET
        storageID = NULL,
        storageVersion = NULL,
        storageUnknownFields = NULL,
        storageNeedsSync = 0
      WHERE id = $packId;
      `
    ).run({ packId });

    addUninstalledStickerPackSync({
      id: packId,
      uninstalledAt: timestamp,
      storageNeedsSync: true,
    });
  })();
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

type StoryDistributionForDatabase = Readonly<
  {
    allowsReplies: 0 | 1;
    deletedAtTimestamp: number | null;
    isBlockList: 0 | 1;
    senderKeyInfoJson: string | null;
    storageID: string | null;
    storageVersion: number | null;
    storageNeedsSync: 0 | 1;
  } & Omit<
    StoryDistributionType,
    | 'allowsReplies'
    | 'deletedAtTimestamp'
    | 'isBlockList'
    | 'senderKeyInfo'
    | 'storageID'
    | 'storageVersion'
    | 'storageNeedsSync'
  >
>;

function hydrateStoryDistribution(
  fromDatabase: StoryDistributionForDatabase
): StoryDistributionType {
  return {
    ...omit(fromDatabase, 'senderKeyInfoJson'),
    allowsReplies: Boolean(fromDatabase.allowsReplies),
    deletedAtTimestamp: fromDatabase.deletedAtTimestamp || undefined,
    isBlockList: Boolean(fromDatabase.isBlockList),
    senderKeyInfo: fromDatabase.senderKeyInfoJson
      ? JSON.parse(fromDatabase.senderKeyInfoJson)
      : undefined,
    storageID: fromDatabase.storageID || undefined,
    storageVersion: fromDatabase.storageVersion || undefined,
    storageNeedsSync: Boolean(fromDatabase.storageNeedsSync),
    storageUnknownFields: fromDatabase.storageUnknownFields || undefined,
  };
}
function freezeStoryDistribution(
  story: StoryDistributionType
): StoryDistributionForDatabase {
  return {
    ...omit(story, 'senderKeyInfo'),
    allowsReplies: story.allowsReplies ? 1 : 0,
    deletedAtTimestamp: story.deletedAtTimestamp || null,
    isBlockList: story.isBlockList ? 1 : 0,
    senderKeyInfoJson: story.senderKeyInfo
      ? JSON.stringify(story.senderKeyInfo)
      : null,
    storageID: story.storageID || null,
    storageVersion: story.storageVersion || null,
    storageNeedsSync: story.storageNeedsSync ? 1 : 0,
    storageUnknownFields: story.storageUnknownFields || null,
  };
}

async function _getAllStoryDistributions(): Promise<
  Array<StoryDistributionType>
> {
  const db = getInstance();
  const storyDistributions = db
    .prepare<EmptyQuery>('SELECT * FROM storyDistributions;')
    .all();

  return storyDistributions.map(hydrateStoryDistribution);
}
async function _getAllStoryDistributionMembers(): Promise<
  Array<StoryDistributionMemberType>
> {
  const db = getInstance();
  return db
    .prepare<EmptyQuery>('SELECT * FROM storyDistributionMembers;')
    .all();
}
async function _deleteAllStoryDistributions(): Promise<void> {
  const db = getInstance();
  db.prepare<EmptyQuery>('DELETE FROM storyDistributions;').run();
}
async function createNewStoryDistribution(
  distribution: StoryDistributionWithMembersType
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    const payload = freezeStoryDistribution(distribution);

    prepare(
      db,
      `
      INSERT INTO storyDistributions(
        id,
        name,
        deletedAtTimestamp,
        allowsReplies,
        isBlockList,
        senderKeyInfoJson,
        storageID,
        storageVersion,
        storageUnknownFields,
        storageNeedsSync
      ) VALUES (
        $id,
        $name,
        $deletedAtTimestamp,
        $allowsReplies,
        $isBlockList,
        $senderKeyInfoJson,
        $storageID,
        $storageVersion,
        $storageUnknownFields,
        $storageNeedsSync
      );
      `
    ).run(payload);

    const { id: listId, members } = distribution;

    const memberInsertStatement = prepare(
      db,
      `
      INSERT OR REPLACE INTO storyDistributionMembers (
        listId,
        uuid
      ) VALUES (
        $listId,
        $uuid
      );
      `
    );

    for (const uuid of members) {
      memberInsertStatement.run({
        listId,
        uuid,
      });
    }
  })();
}
async function getAllStoryDistributionsWithMembers(): Promise<
  Array<StoryDistributionWithMembersType>
> {
  const allDistributions = await _getAllStoryDistributions();
  const allMembers = await _getAllStoryDistributionMembers();

  const byListId = groupBy(allMembers, member => member.listId);

  return allDistributions.map(list => ({
    ...list,
    members: (byListId[list.id] || []).map(member => member.uuid),
  }));
}
async function getStoryDistributionWithMembers(
  id: string
): Promise<StoryDistributionWithMembersType | undefined> {
  const db = getInstance();
  const storyDistribution = prepare(
    db,
    'SELECT * FROM storyDistributions WHERE id = $id;'
  ).get({
    id,
  });

  if (!storyDistribution) {
    return undefined;
  }

  const members = prepare(
    db,
    'SELECT * FROM storyDistributionMembers WHERE listId = $id;'
  ).all({
    id,
  });

  return {
    ...storyDistribution,
    members: members.map(({ uuid }) => uuid),
  };
}
function modifyStoryDistributionSync(
  db: Database,
  payload: StoryDistributionForDatabase
): void {
  prepare(
    db,
    `
    UPDATE storyDistributions
    SET
      name = $name,
      deletedAtTimestamp = $deletedAtTimestamp,
      allowsReplies = $allowsReplies,
      isBlockList = $isBlockList,
      senderKeyInfoJson = $senderKeyInfoJson,
      storageID = $storageID,
      storageVersion = $storageVersion,
      storageUnknownFields = $storageUnknownFields,
      storageNeedsSync = $storageNeedsSync
    WHERE id = $id
    `
  ).run(payload);
}
function modifyStoryDistributionMembersSync(
  db: Database,
  listId: string,
  {
    toAdd,
    toRemove,
  }: { toAdd: Array<UUIDStringType>; toRemove: Array<UUIDStringType> }
) {
  const memberInsertStatement = prepare(
    db,
    `
    INSERT OR REPLACE INTO storyDistributionMembers (
      listId,
      uuid
    ) VALUES (
      $listId,
      $uuid
    );
    `
  );

  for (const uuid of toAdd) {
    memberInsertStatement.run({
      listId,
      uuid,
    });
  }

  batchMultiVarQuery(db, toRemove, (uuids: Array<UUIDStringType>) => {
    db.prepare<ArrayQuery>(
      `
      DELETE FROM storyDistributionMembers
      WHERE listId = ? AND uuid IN ( ${uuids.map(() => '?').join(', ')} );
      `
    ).run([listId, ...uuids]);
  });
}
async function modifyStoryDistributionWithMembers(
  distribution: StoryDistributionType,
  {
    toAdd,
    toRemove,
  }: { toAdd: Array<UUIDStringType>; toRemove: Array<UUIDStringType> }
): Promise<void> {
  const payload = freezeStoryDistribution(distribution);
  const db = getInstance();

  if (toAdd.length || toRemove.length) {
    db.transaction(() => {
      modifyStoryDistributionSync(db, payload);
      modifyStoryDistributionMembersSync(db, payload.id, { toAdd, toRemove });
    })();
  } else {
    modifyStoryDistributionSync(db, payload);
  }
}
async function modifyStoryDistribution(
  distribution: StoryDistributionType
): Promise<void> {
  const payload = freezeStoryDistribution(distribution);
  const db = getInstance();
  modifyStoryDistributionSync(db, payload);
}
async function modifyStoryDistributionMembers(
  listId: string,
  {
    toAdd,
    toRemove,
  }: { toAdd: Array<UUIDStringType>; toRemove: Array<UUIDStringType> }
): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    modifyStoryDistributionMembersSync(db, listId, { toAdd, toRemove });
  })();
}
async function deleteStoryDistribution(id: UUIDStringType): Promise<void> {
  const db = getInstance();
  db.prepare<Query>('DELETE FROM storyDistributions WHERE id = $id;').run({
    id,
  });
}

async function _getAllStoryReads(): Promise<Array<StoryReadType>> {
  const db = getInstance();
  return db.prepare<EmptyQuery>('SELECT * FROM storyReads;').all();
}
async function _deleteAllStoryReads(): Promise<void> {
  const db = getInstance();
  db.prepare<EmptyQuery>('DELETE FROM storyReads;').run();
}
async function addNewStoryRead(read: StoryReadType): Promise<void> {
  const db = getInstance();

  prepare(
    db,
    `
    INSERT OR REPLACE INTO storyReads(
      authorId,
      conversationId,
      storyId,
      storyReadDate
    ) VALUES (
      $authorId,
      $conversationId,
      $storyId,
      $storyReadDate
    );
    `
  ).run(read);
}
async function getLastStoryReadsForAuthor({
  authorId,
  conversationId,
  limit: initialLimit,
}: {
  authorId: UUIDStringType;
  conversationId?: UUIDStringType;
  limit?: number;
}): Promise<Array<StoryReadType>> {
  const limit = initialLimit || 5;

  const db = getInstance();
  return db
    .prepare<Query>(
      `
      SELECT * FROM storyReads
      WHERE
        authorId = $authorId AND
        ($conversationId IS NULL OR conversationId = $conversationId)
      ORDER BY storyReadDate DESC
      LIMIT $limit;
      `
    )
    .all({
      authorId,
      conversationId: conversationId || null,
      limit,
    });
}

async function countStoryReadsByConversation(
  conversationId: string
): Promise<number> {
  const db = getInstance();
  return db
    .prepare<Query>(
      `
      SELECT COUNT(storyId) FROM storyReads
      WHERE conversationId = $conversationId;
      `
    )
    .pluck()
    .get({ conversationId });
}

// All data in database
async function removeAll(): Promise<void> {
  const db = getInstance();

  db.transaction(() => {
    db.exec(`
      DELETE FROM attachment_downloads;
      DELETE FROM badgeImageFiles;
      DELETE FROM badges;
      DELETE FROM conversations;
      DELETE FROM emojis;
      DELETE FROM groupCallRings;
      DELETE FROM identityKeys;
      DELETE FROM items;
      DELETE FROM jobs;
      DELETE FROM messages_fts;
      DELETE FROM messages;
      DELETE FROM preKeys;
      DELETE FROM reactions;
      DELETE FROM senderKeys;
      DELETE FROM sendLogMessageIds;
      DELETE FROM sendLogPayloads;
      DELETE FROM sendLogRecipients;
      DELETE FROM sessions;
      DELETE FROM signedPreKeys;
      DELETE FROM sticker_packs;
      DELETE FROM sticker_references;
      DELETE FROM stickers;
      DELETE FROM storyDistributionMembers;
      DELETE FROM storyDistributions;
      DELETE FROM storyReads;
      DELETE FROM unprocessed;
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
      DELETE FROM jobs;
      DELETE FROM preKeys;
      DELETE FROM senderKeys;
      DELETE FROM sendLogMessageIds;
      DELETE FROM sendLogPayloads;
      DELETE FROM sendLogRecipients;
      DELETE FROM sessions;
      DELETE FROM signedPreKeys;
      DELETE FROM unprocessed;
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

const MAX_MESSAGE_MIGRATION_ATTEMPTS = 5;

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
      WHERE
        (schemaVersion IS NULL OR schemaVersion < $maxVersion) AND
        IFNULL(
          json_extract(json, '$.schemaMigrationAttempts'),
          0
        ) < $maxAttempts
      LIMIT $limit;
      `
    )
    .all({
      maxVersion,
      maxAttempts: MAX_MESSAGE_MIGRATION_ATTEMPTS,
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
        isStory IS 0 AND
        storyId IS NULL AND
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
        isStory IS 0 AND
        storyId IS NULL AND
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
  return getJobsInQueueSync(db, queueType);
}

export function getJobsInQueueSync(
  db: Database,
  queueType: string
): Array<StoredJob> {
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

export function insertJobSync(db: Database, job: Readonly<StoredJob>): void {
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

async function removeAllProfileKeyCredentials(): Promise<void> {
  const db = getInstance();

  db.exec(
    `
    UPDATE conversations
    SET
      json = json_remove(json, '$.profileKeyCredential')
    `
  );
}
