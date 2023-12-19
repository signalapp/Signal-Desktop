// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

import { mkdirSync } from 'fs';
import { join } from 'path';
import rimraf from 'rimraf';
import { randomBytes } from 'crypto';
import type { Database, Statement } from '@signalapp/better-sqlite3';
import SQL from '@signalapp/better-sqlite3';
import pProps from 'p-props';
import { v4 as generateUuid } from 'uuid';
import { z } from 'zod';

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

import * as Errors from '../types/errors';
import { ReadStatus } from '../messages/MessageReadStatus';
import type { GroupV2MemberType } from '../model-types.d';
import type { ReactionType } from '../types/Reactions';
import { ReactionReadStatus } from '../types/Reactions';
import { STORAGE_UI_KEYS } from '../types/StorageUIKeys';
import type { StoryDistributionIdString } from '../types/StoryDistributionId';
import type { ServiceIdString, AciString } from '../types/ServiceId';
import { isServiceIdString } from '../types/ServiceId';
import type { StoredJob } from '../jobs/types';
import { assertDev, assertSync, strictAssert } from '../util/assert';
import { combineNames } from '../util/combineNames';
import { consoleLogger } from '../util/consoleLogger';
import { dropNull } from '../util/dropNull';
import { isNormalNumber } from '../util/isNormalNumber';
import { isNotNil } from '../util/isNotNil';
import { parseIntOrThrow } from '../util/parseIntOrThrow';
import * as durations from '../util/durations';
import { formatCountForLogging } from '../logging/formatCountForLogging';
import type { ConversationColorType, CustomColorType } from '../types/Colors';
import type { BadgeType, BadgeImageType } from '../badges/types';
import { parseBadgeCategory } from '../badges/BadgeCategory';
import { parseBadgeImageTheme } from '../badges/BadgeImageTheme';
import type { LoggerType } from '../types/Logging';
import * as log from '../logging/log';
import type {
  EmptyQuery,
  ArrayQuery,
  Query,
  JSONRows,
  QueryFragment,
} from './util';
import {
  sqlConstant,
  sqlJoin,
  sqlFragment,
  sql,
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
  setUserVersion,
  getUserVersion,
  getSchemaVersion,
} from './util';
import { updateSchema } from './migrations';

import type {
  AdjacentMessagesByConversationOptionsType,
  StoredAllItemsType,
  AttachmentDownloadJobType,
  ConversationMetricsType,
  ConversationType,
  DeleteSentProtoRecipientOptionsType,
  DeleteSentProtoRecipientResultType,
  EditedMessageType,
  EmojiType,
  FTSOptimizationStateType,
  GetAllStoriesResultType,
  GetConversationRangeCenteredOnMessageResultType,
  GetKnownMessageAttachmentsResultType,
  GetRecentStoryRepliesOptionsType,
  GetUnreadByConversationAndMarkReadResultType,
  IdentityKeyIdType,
  StoredIdentityKeyType,
  InstalledStickerPackType,
  ItemKeyType,
  StoredItemType,
  ConversationMessageStatsType,
  MessageAttachmentsCursorType,
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
  GetNearbyMessageFromDeletedSetOptionsType,
  StoredKyberPreKeyType,
} from './Interface';
import { SeenStatus } from '../MessageSeenStatus';
import {
  SNIPPET_LEFT_PLACEHOLDER,
  SNIPPET_RIGHT_PLACEHOLDER,
  SNIPPET_TRUNCATION_PLACEHOLDER,
} from '../util/search';
import type {
  CallHistoryDetails,
  CallHistoryFilter,
  CallHistoryGroup,
  CallHistoryPagination,
} from '../types/CallDisposition';
import {
  DirectCallStatus,
  callHistoryGroupSchema,
  CallHistoryFilterStatus,
  callHistoryDetailsSchema,
  CallDirection,
} from '../types/CallDisposition';

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

  createOrUpdateKyberPreKey,
  getKyberPreKeyById,
  bulkAddKyberPreKeys,
  removeKyberPreKeyById,
  removeKyberPreKeysByServiceId,
  removeAllKyberPreKeys,
  getAllKyberPreKeys,

  createOrUpdatePreKey,
  getPreKeyById,
  bulkAddPreKeys,
  removePreKeyById,
  removePreKeysByServiceId,
  removeAllPreKeys,
  getAllPreKeys,

  createOrUpdateSignedPreKey,
  getSignedPreKeyById,
  bulkAddSignedPreKeys,
  removeSignedPreKeyById,
  removeSignedPreKeysByServiceId,
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
  removeSessionsByServiceId,
  removeAllSessions,
  getAllSessions,

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
  getAllGroupsInvolvingServiceId,

  searchMessages,

  getMessageCount,
  getStoryCount,
  getRecentStoryReplies,
  saveMessage,
  saveMessages,
  removeMessage,
  removeMessages,
  getUnreadByConversationAndMarkRead,
  getUnreadReactionsAndMarkRead,
  markReactionAsRead,
  getReactionByTimestamp,
  addReaction,
  removeReactionFromConversation,
  _getAllReactions,
  _removeAllReactions,
  getMessageBySender,
  getMessageById,
  getMessagesById,
  _getAllMessages,
  _getAllEditedMessages,
  _removeAllMessages,
  getAllMessageIds,
  getMessagesBySentAt,
  getUnreadEditedMessagesAndMarkRead,
  getExpiredMessages,
  getMessagesUnexpectedlyMissingExpirationStartTimestamp,
  getSoonestMessageExpiry,
  getNextTapToViewMessageTimestampToAgeOut,
  getTapToViewMessagesNeedingErase,
  getOlderMessagesByConversation,
  getAllStories,
  getNewerMessagesByConversation,
  getOldestUnreadMentionOfMeForConversation,
  getTotalUnreadForConversation,
  getTotalUnreadMentionsOfMeForConversation,
  getMessageMetricsForConversation,
  getConversationRangeCenteredOnMessage,
  getConversationMessageStats,
  getLastConversationMessage,
  getAllCallHistory,
  clearCallHistory,
  cleanupCallHistoryMessages,
  getCallHistoryUnreadCount,
  markCallHistoryRead,
  markAllCallHistoryRead,
  getCallHistoryMessageByCallId,
  getCallHistory,
  getCallHistoryGroupsCount,
  getCallHistoryGroups,
  saveCallHistory,
  hasGroupCallHistoryMessage,
  migrateConversationMessages,
  getMessagesBetween,
  getNearbyMessageFromDeletedSet,
  saveEditedMessage,

  getUnprocessedCount,
  getUnprocessedByIdsAndIncrementAttempts,
  getAllUnprocessedIds,
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
  eraseStorageServiceState,

  getMessagesNeedingUpgrade,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,
  getMessageServerGuidsForSpam,

  getJobsInQueue,
  insertJob,
  deleteJob,

  wasGroupCallRingPreviouslyCanceled,
  processGroupCallRingCancellation,
  cleanExpiredGroupCallRingCancellations,

  getMaxMessageCounter,

  getStatisticsForLogging,

  optimizeFTS,

  // Server-only

  initialize,

  getKnownMessageAttachments,
  finishGetKnownMessageAttachments,
  getKnownConversationAttachments,
  removeKnownStickers,
  removeKnownDraftAttachments,
  getAllBadgeImageFileLocalPaths,

  runCorruptionChecks,
};
export default dataInterface;

type DatabaseQueryCache = Map<string, Statement<Array<unknown>>>;

const statementCache = new WeakMap<Database, DatabaseQueryCache>();

function prepare<T extends Array<unknown> | Record<string, unknown>>(
  db: Database,
  query: string,
  { pluck = false }: { pluck?: boolean } = {}
): Statement<T> {
  let dbCache = statementCache.get(db);
  if (!dbCache) {
    dbCache = new Map();
    statementCache.set(db, dbCache);
  }

  const cacheKey = `${pluck}:${query}`;
  let result = dbCache.get(cacheKey) as Statement<T>;
  if (!result) {
    result = db.prepare<T>(query);
    if (pluck === true) {
      result.pluck();
    }
    dbCache.set(cacheKey, result);
  }

  return result;
}

function rowToConversation(row: ConversationRow): ConversationType {
  const parsedJson = JSON.parse(row.json);

  let profileLastFetchedAt: undefined | number;
  if (isNormalNumber(row.profileLastFetchedAt)) {
    profileLastFetchedAt = row.profileLastFetchedAt;
  } else {
    assertDev(
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

function openAndMigrateDatabase(
  filePath: string,
  key: string,
  readonly: boolean
) {
  let db: Database | undefined;

  // First, we try to open the database without any cipher changes
  try {
    db = new SQL(filePath, {
      readonly,
    });
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
function openAndSetUpSQLCipher(
  filePath: string,
  { key, readonly }: { key: string; readonly: boolean }
) {
  const match = INVALID_KEY.exec(key);
  if (match) {
    throw new Error(`setupSQLCipher: key '${key}' is not valid`);
  }

  const db = openAndMigrateDatabase(filePath, key, readonly);

  // Because foreign key support is not enabled by default!
  db.pragma('foreign_keys = ON');

  return db;
}

let globalWritableInstance: Database | undefined;
let globalReadonlyInstance: Database | undefined;
let logger = consoleLogger;
let databaseFilePath: string | undefined;
let indexedDBPath: string | undefined;

SQL.setLogHandler((code, value) => {
  logger.warn(`Database log code=${code}: ${value}`);
});

async function initialize({
  configDir,
  key,
  logger: suppliedLogger,
}: {
  appVersion: string;
  configDir: string;
  key: string;
  logger: LoggerType;
}): Promise<void> {
  if (globalWritableInstance || globalReadonlyInstance) {
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

  let writable: Database | undefined;
  let readonly: Database | undefined;

  try {
    writable = openAndSetUpSQLCipher(databaseFilePath, {
      key,
      readonly: false,
    });

    // For profiling use:
    // db.pragma('cipher_profile=\'sqlcipher.log\'');

    updateSchema(writable, logger);

    readonly = openAndSetUpSQLCipher(databaseFilePath, { key, readonly: true });

    // At this point we can allow general access to the database
    globalWritableInstance = writable;
    globalReadonlyInstance = readonly;

    // test database
    getMessageCountSync();
  } catch (error) {
    logger.error('Database startup error:', error.stack);
    readonly?.close();
    writable?.close();
    throw error;
  }
}

async function close(): Promise<void> {
  // SQLLite documentation suggests that we run `PRAGMA optimize` right
  // before closing the database connection.
  globalWritableInstance?.pragma('optimize');

  globalWritableInstance?.close();
  globalWritableInstance = undefined;
  globalReadonlyInstance?.close();
  globalReadonlyInstance = undefined;
}

async function removeDB(): Promise<void> {
  if (globalWritableInstance) {
    try {
      globalWritableInstance.close();
    } catch (error) {
      logger.error('removeDB: Failed to close database:', error.stack);
    }
    globalWritableInstance = undefined;
  }
  if (globalReadonlyInstance) {
    try {
      globalReadonlyInstance.close();
    } catch (error) {
      logger.error('removeDB: Failed to close readonly database:', error.stack);
    }
    globalReadonlyInstance = undefined;
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

function getReadonlyInstance(): Database {
  if (!globalReadonlyInstance) {
    throw new Error('getReadonlyInstance: globalReadonlyInstance not set!');
  }

  return globalReadonlyInstance;
}

async function getWritableInstance(): Promise<Database> {
  if (!globalWritableInstance) {
    throw new Error('getWritableInstance: globalWritableInstance not set!');
  }

  return globalWritableInstance;
}

// This is okay to use for queries that:
//
// - Don't modify persistent tables, but create and do work in temporary
//   tables
// - Integrity checks
//
function getUnsafeWritableInstance(
  reason: 'only temp table use' | 'integrity check'
): Database {
  // Not actually used
  void reason;

  if (!globalWritableInstance) {
    throw new Error(
      'getUnsafeWritableInstance: globalWritableInstance not set!'
    );
  }

  return globalWritableInstance;
}

const IDENTITY_KEYS_TABLE = 'identityKeys';
async function createOrUpdateIdentityKey(
  data: StoredIdentityKeyType
): Promise<void> {
  return createOrUpdate(await getWritableInstance(), IDENTITY_KEYS_TABLE, data);
}
async function getIdentityKeyById(
  id: IdentityKeyIdType
): Promise<StoredIdentityKeyType | undefined> {
  return getById(getReadonlyInstance(), IDENTITY_KEYS_TABLE, id);
}
async function bulkAddIdentityKeys(
  array: Array<StoredIdentityKeyType>
): Promise<void> {
  return bulkAdd(await getWritableInstance(), IDENTITY_KEYS_TABLE, array);
}
async function removeIdentityKeyById(id: IdentityKeyIdType): Promise<number> {
  return removeById(await getWritableInstance(), IDENTITY_KEYS_TABLE, id);
}
async function removeAllIdentityKeys(): Promise<number> {
  return removeAllFromTable(await getWritableInstance(), IDENTITY_KEYS_TABLE);
}
async function getAllIdentityKeys(): Promise<Array<StoredIdentityKeyType>> {
  return getAllFromTable(getReadonlyInstance(), IDENTITY_KEYS_TABLE);
}

const KYBER_PRE_KEYS_TABLE = 'kyberPreKeys';
async function createOrUpdateKyberPreKey(
  data: StoredKyberPreKeyType
): Promise<void> {
  return createOrUpdate(
    await getWritableInstance(),
    KYBER_PRE_KEYS_TABLE,
    data
  );
}
async function getKyberPreKeyById(
  id: PreKeyIdType
): Promise<StoredKyberPreKeyType | undefined> {
  return getById(getReadonlyInstance(), KYBER_PRE_KEYS_TABLE, id);
}
async function bulkAddKyberPreKeys(
  array: Array<StoredKyberPreKeyType>
): Promise<void> {
  return bulkAdd(await getWritableInstance(), KYBER_PRE_KEYS_TABLE, array);
}
async function removeKyberPreKeyById(
  id: PreKeyIdType | Array<PreKeyIdType>
): Promise<number> {
  return removeById(await getWritableInstance(), KYBER_PRE_KEYS_TABLE, id);
}
async function removeKyberPreKeysByServiceId(
  serviceId: ServiceIdString
): Promise<void> {
  const db = await getWritableInstance();
  db.prepare<Query>(
    'DELETE FROM kyberPreKeys WHERE ourServiceId IS $serviceId;'
  ).run({
    serviceId,
  });
}
async function removeAllKyberPreKeys(): Promise<number> {
  return removeAllFromTable(await getWritableInstance(), KYBER_PRE_KEYS_TABLE);
}
async function getAllKyberPreKeys(): Promise<Array<StoredKyberPreKeyType>> {
  return getAllFromTable(getReadonlyInstance(), KYBER_PRE_KEYS_TABLE);
}

const PRE_KEYS_TABLE = 'preKeys';
async function createOrUpdatePreKey(data: StoredPreKeyType): Promise<void> {
  return createOrUpdate(await getWritableInstance(), PRE_KEYS_TABLE, data);
}
async function getPreKeyById(
  id: PreKeyIdType
): Promise<StoredPreKeyType | undefined> {
  return getById(getReadonlyInstance(), PRE_KEYS_TABLE, id);
}
async function bulkAddPreKeys(array: Array<StoredPreKeyType>): Promise<void> {
  return bulkAdd(await getWritableInstance(), PRE_KEYS_TABLE, array);
}
async function removePreKeyById(
  id: PreKeyIdType | Array<PreKeyIdType>
): Promise<number> {
  return removeById(await getWritableInstance(), PRE_KEYS_TABLE, id);
}
async function removePreKeysByServiceId(
  serviceId: ServiceIdString
): Promise<void> {
  const db = await getWritableInstance();
  db.prepare<Query>(
    'DELETE FROM preKeys WHERE ourServiceId IS $serviceId;'
  ).run({
    serviceId,
  });
}
async function removeAllPreKeys(): Promise<number> {
  return removeAllFromTable(await getWritableInstance(), PRE_KEYS_TABLE);
}
async function getAllPreKeys(): Promise<Array<StoredPreKeyType>> {
  return getAllFromTable(getReadonlyInstance(), PRE_KEYS_TABLE);
}

const SIGNED_PRE_KEYS_TABLE = 'signedPreKeys';
async function createOrUpdateSignedPreKey(
  data: StoredSignedPreKeyType
): Promise<void> {
  return createOrUpdate(
    await getWritableInstance(),
    SIGNED_PRE_KEYS_TABLE,
    data
  );
}
async function getSignedPreKeyById(
  id: SignedPreKeyIdType
): Promise<StoredSignedPreKeyType | undefined> {
  return getById(getReadonlyInstance(), SIGNED_PRE_KEYS_TABLE, id);
}
async function bulkAddSignedPreKeys(
  array: Array<StoredSignedPreKeyType>
): Promise<void> {
  return bulkAdd(await getWritableInstance(), SIGNED_PRE_KEYS_TABLE, array);
}
async function removeSignedPreKeyById(
  id: SignedPreKeyIdType | Array<SignedPreKeyIdType>
): Promise<number> {
  return removeById(await getWritableInstance(), SIGNED_PRE_KEYS_TABLE, id);
}
async function removeSignedPreKeysByServiceId(
  serviceId: ServiceIdString
): Promise<void> {
  const db = await getWritableInstance();
  db.prepare<Query>(
    'DELETE FROM signedPreKeys WHERE ourServiceId IS $serviceId;'
  ).run({
    serviceId,
  });
}
async function removeAllSignedPreKeys(): Promise<number> {
  return removeAllFromTable(await getWritableInstance(), SIGNED_PRE_KEYS_TABLE);
}
async function getAllSignedPreKeys(): Promise<Array<StoredSignedPreKeyType>> {
  const db = getReadonlyInstance();
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
  return createOrUpdate(await getWritableInstance(), ITEMS_TABLE, data);
}
async function getItemById<K extends ItemKeyType>(
  id: K
): Promise<StoredItemType<K> | undefined> {
  return getById(getReadonlyInstance(), ITEMS_TABLE, id);
}
async function getAllItems(): Promise<StoredAllItemsType> {
  const db = getReadonlyInstance();
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
async function removeItemById(
  id: ItemKeyType | Array<ItemKeyType>
): Promise<number> {
  return removeById(await getWritableInstance(), ITEMS_TABLE, id);
}
async function removeAllItems(): Promise<number> {
  return removeAllFromTable(await getWritableInstance(), ITEMS_TABLE);
}

async function createOrUpdateSenderKey(key: SenderKeyType): Promise<void> {
  const db = await getWritableInstance();
  createOrUpdateSenderKeySync(db, key);
}

function createOrUpdateSenderKeySync(db: Database, key: SenderKeyType): void {
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
  const db = getReadonlyInstance();
  const row = prepare(db, 'SELECT * FROM senderKeys WHERE id = $id').get({
    id,
  });

  return row;
}
async function removeAllSenderKeys(): Promise<void> {
  const db = await getWritableInstance();
  prepare<EmptyQuery>(db, 'DELETE FROM senderKeys').run();
}
async function getAllSenderKeys(): Promise<Array<SenderKeyType>> {
  const db = getReadonlyInstance();
  const rows = prepare<EmptyQuery>(db, 'SELECT * FROM senderKeys').all();

  return rows;
}
async function removeSenderKeyById(id: SenderKeyIdType): Promise<void> {
  const db = await getWritableInstance();
  prepare(db, 'DELETE FROM senderKeys WHERE id = $id').run({ id });
}

async function insertSentProto(
  proto: SentProtoType,
  options: {
    recipients: SentRecipientsType;
    messageIds: SentMessagesType;
  }
): Promise<number> {
  const db = await getWritableInstance();
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
        urgent,
        hasPniSignatureMessage
      ) VALUES (
        $contentHint,
        $proto,
        $timestamp,
        $urgent,
        $hasPniSignatureMessage
      );
      `
    ).run({
      ...proto,
      urgent: proto.urgent ? 1 : 0,
      hasPniSignatureMessage: proto.hasPniSignatureMessage ? 1 : 0,
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
        recipientServiceId,
        deviceId
      ) VALUES (
        $id,
        $recipientServiceId,
        $deviceId
      );
      `
    );

    const recipientServiceIds = Object.keys(recipients);
    for (const recipientServiceId of recipientServiceIds) {
      strictAssert(
        isServiceIdString(recipientServiceId),
        'Recipient must be a service id'
      );
      const deviceIds = recipients[recipientServiceId];

      for (const deviceId of deviceIds) {
        recipientStatement.run({
          id,
          recipientServiceId,
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

    for (const messageId of new Set(messageIds)) {
      messageStatement.run({
        id,
        messageId,
      });
    }

    return id;
  })();
}

async function deleteSentProtosOlderThan(timestamp: number): Promise<void> {
  const db = await getWritableInstance();

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
  const db = await getWritableInstance();

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
  recipientServiceId,
  deviceIds,
}: {
  id: number;
  recipientServiceId: ServiceIdString;
  deviceIds: Array<number>;
}): Promise<void> {
  const db = await getWritableInstance();

  db.transaction(() => {
    const statement = prepare(
      db,
      `
      INSERT INTO sendLogRecipients (
        payloadId,
        recipientServiceId,
        deviceId
      ) VALUES (
        $id,
        $recipientServiceId,
        $deviceId
      );
      `
    );

    for (const deviceId of deviceIds) {
      statement.run({
        id,
        recipientServiceId,
        deviceId,
      });
    }
  })();
}

async function deleteSentProtoRecipient(
  options:
    | DeleteSentProtoRecipientOptionsType
    | ReadonlyArray<DeleteSentProtoRecipientOptionsType>
): Promise<DeleteSentProtoRecipientResultType> {
  const db = await getWritableInstance();

  const items = Array.isArray(options) ? options : [options];

  // Note: we use `pluck` in this function to fetch only the first column of
  // returned row.

  return db.transaction(() => {
    const successfulPhoneNumberShares = new Array<ServiceIdString>();

    for (const item of items) {
      const { timestamp, recipientServiceId, deviceId } = item;

      // 1. Figure out what payload we're talking about.
      const rows = prepare(
        db,
        `
        SELECT sendLogPayloads.id, sendLogPayloads.hasPniSignatureMessage
        FROM sendLogPayloads
        INNER JOIN sendLogRecipients
          ON sendLogRecipients.payloadId = sendLogPayloads.id
        WHERE
          sendLogPayloads.timestamp = $timestamp AND
          sendLogRecipients.recipientServiceId = $recipientServiceId AND
          sendLogRecipients.deviceId = $deviceId;
       `
      ).all({ timestamp, recipientServiceId, deviceId });
      if (!rows.length) {
        continue;
      }
      if (rows.length > 1) {
        logger.warn(
          'deleteSentProtoRecipient: More than one payload matches ' +
            `recipient and timestamp ${timestamp}. Using the first.`
        );
      }

      const { id, hasPniSignatureMessage } = rows[0];

      // 2. Delete the recipient/device combination in question.
      prepare(
        db,
        `
        DELETE FROM sendLogRecipients
        WHERE
          payloadId = $id AND
          recipientServiceId = $recipientServiceId AND
          deviceId = $deviceId;
        `
      ).run({ id, recipientServiceId, deviceId });

      // 3. See how many more recipient devices there were for this payload.
      const remainingDevices = prepare(
        db,
        `
        SELECT count(1) FROM sendLogRecipients
        WHERE payloadId = $id AND recipientServiceId = $recipientServiceId;
        `,
        { pluck: true }
      ).get({ id, recipientServiceId });

      // 4. If there are no remaining devices for this recipient and we included
      //    the pni signature in the proto - return the recipient to the caller.
      if (remainingDevices === 0 && hasPniSignatureMessage) {
        logger.info(
          'deleteSentProtoRecipient: ' +
            `Successfully shared phone number with ${recipientServiceId} ` +
            `through message ${timestamp}`
        );
        successfulPhoneNumberShares.push(recipientServiceId);
      }

      strictAssert(
        isNumber(remainingDevices),
        'deleteSentProtoRecipient: select count() returned non-number!'
      );

      // 5. See how many more recipients there were for this payload.
      const remainingTotal = prepare(
        db,
        'SELECT count(1) FROM sendLogRecipients WHERE payloadId = $id;',
        { pluck: true }
      ).get({ id });

      strictAssert(
        isNumber(remainingTotal),
        'deleteSentProtoRecipient: select count() returned non-number!'
      );

      if (remainingTotal > 0) {
        continue;
      }

      // 6. Delete the entire payload if there are no more recipients left.
      logger.info(
        'deleteSentProtoRecipient: ' +
          `Deleting proto payload for timestamp ${timestamp}`
      );

      prepare(db, 'DELETE FROM sendLogPayloads WHERE id = $id;').run({
        id,
      });
    }

    return { successfulPhoneNumberShares };
  })();
}

async function getSentProtoByRecipient({
  now,
  recipientServiceId,
  timestamp,
}: {
  now: number;
  recipientServiceId: ServiceIdString;
  timestamp: number;
}): Promise<SentProtoWithMessageIdsType | undefined> {
  const HOUR = 1000 * 60 * 60;
  const oneDayAgo = now - HOUR * 24;

  await deleteSentProtosOlderThan(oneDayAgo);

  const db = getReadonlyInstance();

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
      sendLogRecipients.recipientServiceId = $recipientServiceId
    GROUP BY sendLogPayloads.id;
    `
  ).get({
    timestamp,
    recipientServiceId,
  });

  if (!row) {
    return undefined;
  }

  const { messageIds } = row;
  return {
    ...row,
    urgent: isNumber(row.urgent) ? Boolean(row.urgent) : true,
    hasPniSignatureMessage: isNumber(row.hasPniSignatureMessage)
      ? Boolean(row.hasPniSignatureMessage)
      : true,
    messageIds: messageIds ? messageIds.split(',') : [],
  };
}
async function removeAllSentProtos(): Promise<void> {
  const db = await getWritableInstance();
  prepare<EmptyQuery>(db, 'DELETE FROM sendLogPayloads;').run();
}
async function getAllSentProtos(): Promise<Array<SentProtoType>> {
  const db = getReadonlyInstance();
  const rows = prepare<EmptyQuery>(db, 'SELECT * FROM sendLogPayloads;').all();

  return rows.map(row => ({
    ...row,
    urgent: isNumber(row.urgent) ? Boolean(row.urgent) : true,
    hasPniSignatureMessage: isNumber(row.hasPniSignatureMessage)
      ? Boolean(row.hasPniSignatureMessage)
      : true,
  }));
}
async function _getAllSentProtoRecipients(): Promise<
  Array<SentRecipientsDBType>
> {
  const db = getReadonlyInstance();
  const rows = prepare<EmptyQuery>(
    db,
    'SELECT * FROM sendLogRecipients;'
  ).all();

  return rows;
}
async function _getAllSentProtoMessageIds(): Promise<Array<SentMessageDBType>> {
  const db = getReadonlyInstance();
  const rows = prepare<EmptyQuery>(
    db,
    'SELECT * FROM sendLogMessageIds;'
  ).all();

  return rows;
}

const SESSIONS_TABLE = 'sessions';
function createOrUpdateSessionSync(db: Database, data: SessionType): void {
  const { id, conversationId, ourServiceId, serviceId } = data;
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
      ourServiceId,
      serviceId,
      json
    ) values (
      $id,
      $conversationId,
      $ourServiceId,
      $serviceId,
      $json
    )
    `
  ).run({
    id,
    conversationId,
    ourServiceId,
    serviceId,
    json: objectToJSON(data),
  });
}
async function createOrUpdateSession(data: SessionType): Promise<void> {
  const db = await getWritableInstance();
  return createOrUpdateSessionSync(db, data);
}

async function createOrUpdateSessions(
  array: Array<SessionType>
): Promise<void> {
  const db = await getWritableInstance();

  db.transaction(() => {
    for (const item of array) {
      assertSync(createOrUpdateSessionSync(db, item));
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
  const db = await getWritableInstance();

  db.transaction(() => {
    for (const item of senderKeys) {
      assertSync(createOrUpdateSenderKeySync(db, item));
    }

    for (const item of sessions) {
      assertSync(createOrUpdateSessionSync(db, item));
    }

    for (const item of unprocessed) {
      assertSync(saveUnprocessedSync(db, item));
    }
  })();
}

async function bulkAddSessions(array: Array<SessionType>): Promise<void> {
  return bulkAdd(await getWritableInstance(), SESSIONS_TABLE, array);
}
async function removeSessionById(id: SessionIdType): Promise<number> {
  return removeById(await getWritableInstance(), SESSIONS_TABLE, id);
}
async function removeSessionsByConversation(
  conversationId: string
): Promise<void> {
  const db = await getWritableInstance();
  db.prepare<Query>(
    `
    DELETE FROM sessions
    WHERE conversationId = $conversationId;
    `
  ).run({
    conversationId,
  });
}
async function removeSessionsByServiceId(
  serviceId: ServiceIdString
): Promise<void> {
  const db = await getWritableInstance();
  db.prepare<Query>(
    `
    DELETE FROM sessions
    WHERE serviceId = $serviceId;
    `
  ).run({
    serviceId,
  });
}
async function removeAllSessions(): Promise<number> {
  return removeAllFromTable(await getWritableInstance(), SESSIONS_TABLE);
}
async function getAllSessions(): Promise<Array<SessionType>> {
  return getAllFromTable(getReadonlyInstance(), SESSIONS_TABLE);
}
// Conversations

async function getConversationCount(): Promise<number> {
  return getCountFromTable(getReadonlyInstance(), 'conversations');
}

function getConversationMembersList({ members, membersV2 }: ConversationType) {
  if (membersV2) {
    return membersV2.map((item: GroupV2MemberType) => item.aci).join(' ');
  }
  if (members) {
    return members.join(' ');
  }
  return null;
}

function saveConversationSync(db: Database, data: ConversationType): void {
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
    serviceId,
  } = data;

  const membersList = getConversationMembersList(data);

  db.prepare<Query>(
    `
    INSERT INTO conversations (
      id,
      json,

      e164,
      serviceId,
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
      $serviceId,
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
    serviceId: serviceId || null,
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

async function saveConversation(data: ConversationType): Promise<void> {
  const db = await getWritableInstance();
  return saveConversationSync(db, data);
}

async function saveConversations(
  arrayOfConversations: Array<ConversationType>
): Promise<void> {
  const db = await getWritableInstance();

  db.transaction(() => {
    for (const conversation of arrayOfConversations) {
      assertSync(saveConversationSync(db, conversation));
    }
  })();
}

function updateConversationSync(db: Database, data: ConversationType): void {
  const {
    id,
    active_at,
    type,
    name,
    profileName,
    profileFamilyName,
    profileLastFetchedAt,
    e164,
    serviceId,
  } = data;

  const membersList = getConversationMembersList(data);

  db.prepare(
    `
    UPDATE conversations SET
      json = $json,

      e164 = $e164,
      serviceId = $serviceId,

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
    serviceId: serviceId || null,

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
  const db = await getWritableInstance();
  return updateConversationSync(db, data);
}

async function updateConversations(
  array: Array<ConversationType>
): Promise<void> {
  const db = await getWritableInstance();

  db.transaction(() => {
    for (const item of array) {
      assertSync(updateConversationSync(db, item));
    }
  })();
}

function removeConversationsSync(
  db: Database,
  ids: ReadonlyArray<string>
): void {
  // Our node interface doesn't seem to allow you to replace one single ? with an array
  db.prepare<ArrayQuery>(
    `
    DELETE FROM conversations
    WHERE id IN ( ${ids.map(() => '?').join(', ')} );
    `
  ).run(ids);
}

async function removeConversation(id: Array<string> | string): Promise<void> {
  const db = await getWritableInstance();

  if (!Array.isArray(id)) {
    db.prepare<Query>('DELETE FROM conversations WHERE id = $id;').run({
      id,
    });

    return;
  }

  if (!id.length) {
    throw new Error('removeConversation: No ids to delete!');
  }

  batchMultiVarQuery(db, id, ids => removeConversationsSync(db, ids));
}

async function _removeAllConversations(): Promise<void> {
  const db = await getWritableInstance();
  db.prepare<EmptyQuery>('DELETE from conversations;').run();
}

async function getConversationById(
  id: string
): Promise<ConversationType | undefined> {
  const db = getReadonlyInstance();
  const row: { json: string } = db
    .prepare<Query>('SELECT json FROM conversations WHERE id = $id;')
    .get({ id });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}

function getAllConversationsSync(
  db = getReadonlyInstance()
): Array<ConversationType> {
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
  const db = getReadonlyInstance();
  const rows: Array<{ id: string }> = db
    .prepare<EmptyQuery>(
      `
      SELECT id FROM conversations ORDER BY id ASC;
      `
    )
    .all();

  return rows.map(row => row.id);
}

async function getAllGroupsInvolvingServiceId(
  serviceId: ServiceIdString
): Promise<Array<ConversationType>> {
  const db = getReadonlyInstance();
  const rows: ConversationRows = db
    .prepare<Query>(
      `
      SELECT json, profileLastFetchedAt
      FROM conversations WHERE
        type = 'group' AND
        members LIKE $serviceId
      ORDER BY id ASC;
      `
    )
    .all({
      serviceId: `%${serviceId}%`,
    });

  return rows.map(row => rowToConversation(row));
}

async function searchMessages({
  query,
  options,
  conversationId,
  contactServiceIdsMatchingQuery,
}: {
  query: string;
  options?: { limit?: number };
  conversationId?: string;
  contactServiceIdsMatchingQuery?: Array<ServiceIdString>;
}): Promise<Array<ServerSearchResultMessageType>> {
  const { limit = conversationId ? 100 : 500 } = options ?? {};

  const db = getUnsafeWritableInstance('only temp table use');

  const normalizedQuery = db
    .signalTokenize(query)
    .map(token => `"${token.replace(/"/g, '""')}"*`)
    .join(' ');

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
    ).run({ query: normalizedQuery });

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
    const ftsFragment = sqlFragment`
      SELECT
        messages.rowid,
        messages.json,
        messages.sent_at,
        messages.received_at,
        snippet(messages_fts, -1, ${SNIPPET_LEFT_PLACEHOLDER}, ${SNIPPET_RIGHT_PLACEHOLDER}, ${SNIPPET_TRUNCATION_PLACEHOLDER}, 10) AS ftsSnippet
      FROM tmp_filtered_results
      INNER JOIN messages_fts
        ON messages_fts.rowid = tmp_filtered_results.rowid
      INNER JOIN messages
        ON messages.rowid = tmp_filtered_results.rowid
      WHERE
        messages_fts.body MATCH ${normalizedQuery}
      ORDER BY messages.received_at DESC, messages.sent_at DESC
      LIMIT ${limit}
    `;

    let result: Array<ServerSearchResultMessageType>;

    if (!contactServiceIdsMatchingQuery?.length) {
      const [sqlQuery, params] = sql`${ftsFragment};`;
      result = db.prepare(sqlQuery).all(params);
    } else {
      // If contactServiceIdsMatchingQuery is not empty, we due an OUTER JOIN between:
      // 1) the messages that mention at least one of contactServiceIdsMatchingQuery, and
      // 2) the messages that match all the search terms via FTS
      //
      // Note: this groups the results by rowid, so even if one message mentions multiple
      // matching UUIDs, we only return one to be highlighted
      const [sqlQuery, params] = sql`
        SELECT
          messages.rowid as rowid,
          COALESCE(messages.json, ftsResults.json) as json,
          COALESCE(messages.sent_at, ftsResults.sent_at) as sent_at,
          COALESCE(messages.received_at, ftsResults.received_at) as received_at,
          ftsResults.ftsSnippet,
          mentionAci,
          start as mentionStart,
          length as mentionLength
        FROM mentions
        INNER JOIN messages
        ON
          messages.id = mentions.messageId
          AND mentions.mentionAci IN (
            ${sqlJoin(contactServiceIdsMatchingQuery)}
          )
          AND ${
            conversationId
              ? sqlFragment`messages.conversationId = ${conversationId}`
              : '1 IS 1'
          }
          AND messages.isViewOnce IS NOT 1
          AND messages.storyId IS NULL
        FULL OUTER JOIN (
          ${ftsFragment}
        ) as ftsResults
        USING (rowid)
        GROUP BY rowid
        ORDER BY received_at DESC, sent_at DESC
        LIMIT ${limit};
        `;
      result = db.prepare(sqlQuery).all(params);
    }

    db.exec(
      `
      DROP TABLE tmp_results;
      DROP TABLE tmp_filtered_results;
      `
    );
    return result;
  })();
}

function getMessageCountSync(
  conversationId?: string,
  db = getReadonlyInstance()
): number {
  if (conversationId === undefined) {
    return getCountFromTable(db, 'messages');
  }

  const count = db
    .prepare<Query>(
      `
        SELECT count(1)
        FROM messages
        WHERE conversationId = $conversationId;
        `
    )
    .pluck()
    .get({ conversationId });

  return count;
}

async function getStoryCount(conversationId: string): Promise<number> {
  const db = getReadonlyInstance();
  return db
    .prepare<Query>(
      `
        SELECT count(1)
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

// Note: we really only use this in 1:1 conversations, where story replies are always
//   shown, so this has no need to be story-aware.
function hasUserInitiatedMessages(conversationId: string): boolean {
  const db = getReadonlyInstance();

  const exists: number = db
    .prepare<Query>(
      `
      SELECT EXISTS(
        SELECT 1 FROM messages
        INDEXED BY message_user_initiated
        WHERE
          conversationId IS $conversationId AND
          isUserInitiatedMessage IS 1
      );
      `
    )
    .pluck()
    .get({ conversationId });

  return exists !== 0;
}

function saveMessageSync(
  db: Database,
  data: MessageType,
  options: {
    alreadyInTransaction?: boolean;
    forceSave?: boolean;
    jobToInsert?: StoredJob;
    ourAci: AciString;
  }
): string {
  const { alreadyInTransaction, forceSave, jobToInsert, ourAci } = options;

  if (!alreadyInTransaction) {
    return db.transaction(() => {
      return assertSync(
        saveMessageSync(db, data, {
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
    mentionsMe,
    received_at,
    schemaVersion,
    sent_at,
    serverGuid,
    source,
    sourceServiceId,
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
      attachments.every(
        attachment =>
          !attachment.data &&
          !attachment.screenshotData &&
          !attachment.screenshot?.data &&
          !attachment.thumbnail?.data
      ),
      'Attempting to save a message with binary attachment data'
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
    isChangeCreatedByUs: groupV2Change?.from === ourAci ? 1 : 0,
    isErased: isErased ? 1 : 0,
    isViewOnce: isViewOnce ? 1 : 0,
    mentionsMe: mentionsMe ? 1 : 0,
    received_at: received_at || null,
    schemaVersion: schemaVersion || 0,
    serverGuid: serverGuid || null,
    sent_at: sent_at || null,
    source: source || null,
    sourceServiceId: sourceServiceId || null,
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
        mentionsMe = $mentionsMe,
        received_at = $received_at,
        schemaVersion = $schemaVersion,
        serverGuid = $serverGuid,
        sent_at = $sent_at,
        source = $source,
        sourceServiceId = $sourceServiceId,
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
    id: id || generateUuid(),
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
      mentionsMe,
      received_at,
      schemaVersion,
      serverGuid,
      sent_at,
      source,
      sourceServiceId,
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
      $mentionsMe,
      $received_at,
      $schemaVersion,
      $serverGuid,
      $sent_at,
      $source,
      $sourceServiceId,
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
    ourAci: AciString;
  }
): Promise<string> {
  const db = await getWritableInstance();
  return saveMessageSync(db, data, options);
}

async function saveMessages(
  arrayOfMessages: ReadonlyArray<MessageType>,
  options: { forceSave?: boolean; ourAci: AciString }
): Promise<void> {
  const db = await getWritableInstance();

  db.transaction(() => {
    for (const message of arrayOfMessages) {
      assertSync(
        saveMessageSync(db, message, { ...options, alreadyInTransaction: true })
      );
    }
  })();
}

async function removeMessage(id: string): Promise<void> {
  const db = await getWritableInstance();

  db.prepare<Query>('DELETE FROM messages WHERE id = $id;').run({ id });
}

function removeMessagesSync(db: Database, ids: ReadonlyArray<string>): void {
  db.prepare<ArrayQuery>(
    `
    DELETE FROM messages
    WHERE id IN ( ${ids.map(() => '?').join(', ')} );
    `
  ).run(ids);
}

async function removeMessages(ids: ReadonlyArray<string>): Promise<void> {
  const db = await getWritableInstance();
  batchMultiVarQuery(db, ids, batch => removeMessagesSync(db, batch));
}

async function getMessageById(id: string): Promise<MessageType | undefined> {
  const db = getReadonlyInstance();
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
  messageIds: ReadonlyArray<string>
): Promise<Array<MessageType>> {
  const db = getReadonlyInstance();

  return batchMultiVarQuery(
    db,
    messageIds,
    (batch: ReadonlyArray<string>): Array<MessageType> => {
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
  const db = getReadonlyInstance();
  const rows: JSONRows = db
    .prepare<EmptyQuery>('SELECT json FROM messages ORDER BY id ASC;')
    .all();

  return rows.map(row => jsonToObject(row.json));
}
async function _removeAllMessages(): Promise<void> {
  const db = await getWritableInstance();
  db.exec(`
    DELETE FROM messages;
    INSERT INTO messages_fts(messages_fts) VALUES('optimize');
  `);
}

async function getAllMessageIds(): Promise<Array<string>> {
  const db = getReadonlyInstance();
  const rows: Array<{ id: string }> = db
    .prepare<EmptyQuery>('SELECT id FROM messages ORDER BY id ASC;')
    .all();

  return rows.map(row => row.id);
}

async function getMessageBySender({
  source,
  sourceServiceId,
  sourceDevice,
  sent_at,
}: {
  source?: string;
  sourceServiceId?: ServiceIdString;
  sourceDevice?: number;
  sent_at: number;
}): Promise<MessageType | undefined> {
  const db = getReadonlyInstance();
  const rows: JSONRows = prepare(
    db,
    `
    SELECT json FROM messages WHERE
      (source = $source OR sourceServiceId = $sourceServiceId) AND
      sourceDevice = $sourceDevice AND
      sent_at = $sent_at
    LIMIT 2;
    `
  ).all({
    source: source || null,
    sourceServiceId: sourceServiceId || null,
    sourceDevice: sourceDevice || null,
    sent_at,
  });

  if (rows.length > 1) {
    log.warn('getMessageBySender: More than one message found for', {
      sent_at,
      source,
      sourceServiceId,
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
  includeStoryReplies: boolean
): QueryFragment {
  // This is unintuitive, but 'including story replies' means that we need replies to
  //   lots of different stories. So, we remove the storyId check with a clause that will
  //   always be true. We don't just return TRUE because we want to use our passed-in
  //   $storyId parameter.
  if (includeStoryReplies && storyId === undefined) {
    return sqlFragment`${storyId} IS NULL`;
  }

  // In contrast to: replies to a specific story
  return sqlFragment`storyId IS ${storyId}`;
}

async function getUnreadByConversationAndMarkRead({
  conversationId,
  includeStoryReplies,
  newestUnreadAt,
  storyId,
  readAt,
  now = Date.now(),
}: {
  conversationId: string;
  includeStoryReplies: boolean;
  newestUnreadAt: number;
  storyId?: string;
  readAt?: number;
  now?: number;
}): Promise<GetUnreadByConversationAndMarkReadResultType> {
  const db = await getWritableInstance();
  return db.transaction(() => {
    const expirationStartTimestamp = Math.min(now, readAt ?? Infinity);

    const expirationJsonPatch = JSON.stringify({ expirationStartTimestamp });

    const [updateExpirationQuery, updateExpirationParams] = sql`
      UPDATE messages
      INDEXED BY expiring_message_by_conversation_and_received_at
      SET
        expirationStartTimestamp = ${expirationStartTimestamp},
        json = json_patch(json, ${expirationJsonPatch})
      WHERE
        conversationId = ${conversationId} AND
        (${_storyIdPredicate(storyId, includeStoryReplies)}) AND
        isStory IS 0 AND
        type IS 'incoming' AND
        (
          expirationStartTimestamp IS NULL OR
          expirationStartTimestamp > ${expirationStartTimestamp}
        ) AND
        expireTimer > 0 AND
        received_at <= ${newestUnreadAt};
    `;

    db.prepare(updateExpirationQuery).run(updateExpirationParams);

    const [selectQuery, selectParams] = sql`
      SELECT id, json FROM messages
        WHERE
          conversationId = ${conversationId} AND
          seenStatus = ${SeenStatus.Unseen} AND
          isStory = 0 AND
          (${_storyIdPredicate(storyId, includeStoryReplies)}) AND
          received_at <= ${newestUnreadAt}
        ORDER BY received_at DESC, sent_at DESC;
    `;

    const rows = db.prepare(selectQuery).all(selectParams);

    const statusJsonPatch = JSON.stringify({
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.Seen,
    });

    const [updateStatusQuery, updateStatusParams] = sql`
      UPDATE messages
        SET
          readStatus = ${ReadStatus.Read},
          seenStatus = ${SeenStatus.Seen},
          json = json_patch(json, ${statusJsonPatch})
        WHERE
          conversationId = ${conversationId} AND
          seenStatus = ${SeenStatus.Unseen} AND
          isStory = 0 AND
          (${_storyIdPredicate(storyId, includeStoryReplies)}) AND
          received_at <= ${newestUnreadAt};
    `;

    db.prepare(updateStatusQuery).run(updateStatusParams);

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
          'sourceServiceId',
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
  storyId?: string;
}): Promise<Array<ReactionResultType>> {
  const db = await getWritableInstance();

  return db.transaction(() => {
    const unreadMessages: Array<ReactionResultType> = db
      .prepare<Query>(
        `
        SELECT reactions.rowid, targetAuthorAci, targetTimestamp, messageId
        FROM reactions
        INDEXED BY reactions_unread
        JOIN messages on messages.id IS reactions.messageId
        WHERE
          reactions.conversationId IS $conversationId AND
          reactions.unread > 0 AND
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
    batchMultiVarQuery(db, idsToUpdate, (ids: ReadonlyArray<number>): void => {
      db.prepare<ArrayQuery>(
        `
        UPDATE reactions
        SET unread = 0
        WHERE rowid IN ( ${ids.map(() => '?').join(', ')} );
        `
      ).run(ids);
    });

    return unreadMessages;
  })();
}

async function markReactionAsRead(
  targetAuthorServiceId: ServiceIdString,
  targetTimestamp: number
): Promise<ReactionType | undefined> {
  const db = await getWritableInstance();
  return db.transaction(() => {
    const readReaction = db
      .prepare(
        `
          SELECT *
          FROM reactions
          WHERE
            targetAuthorAci = $targetAuthorAci AND
            targetTimestamp = $targetTimestamp AND
            unread = 1
          ORDER BY rowId DESC
          LIMIT 1;
        `
      )
      .get({
        targetAuthorAci: targetAuthorServiceId,
        targetTimestamp,
      });

    db.prepare(
      `
        UPDATE reactions SET
        unread = 0 WHERE
        targetAuthorAci = $targetAuthorAci AND
        targetTimestamp = $targetTimestamp;
      `
    ).run({
      targetAuthorAci: targetAuthorServiceId,
      targetTimestamp,
    });

    return readReaction;
  })();
}

async function getReactionByTimestamp(
  fromId: string,
  timestamp: number
): Promise<ReactionType | undefined> {
  const db = getReadonlyInstance();
  const [query, params] = sql`
    SELECT * FROM reactions
    WHERE fromId IS ${fromId} AND timestamp IS ${timestamp}
  `;

  return db.prepare(query).get(params);
}

async function addReaction(
  {
    conversationId,
    emoji,
    fromId,
    messageId,
    messageReceivedAt,
    targetAuthorAci,
    targetTimestamp,
    timestamp,
  }: ReactionType,
  { readStatus }: { readStatus: ReactionReadStatus }
): Promise<void> {
  const db = await getWritableInstance();
  await db
    .prepare(
      `INSERT INTO reactions (
      conversationId,
      emoji,
      fromId,
      messageId,
      messageReceivedAt,
      targetAuthorAci,
      targetTimestamp,
      timestamp,
      unread
    ) VALUES (
      $conversationId,
      $emoji,
      $fromId,
      $messageId,
      $messageReceivedAt,
      $targetAuthorAci,
      $targetTimestamp,
      $timestamp,
      $unread
    );`
    )
    .run({
      conversationId,
      emoji,
      fromId,
      messageId,
      messageReceivedAt,
      targetAuthorAci,
      targetTimestamp,
      timestamp,
      unread: readStatus === ReactionReadStatus.Unread ? 1 : 0,
    });
}

async function removeReactionFromConversation({
  emoji,
  fromId,
  targetAuthorServiceId,
  targetTimestamp,
}: {
  emoji: string;
  fromId: string;
  targetAuthorServiceId: ServiceIdString;
  targetTimestamp: number;
}): Promise<void> {
  const db = await getWritableInstance();
  await db
    .prepare(
      `DELETE FROM reactions WHERE
      emoji = $emoji AND
      fromId = $fromId AND
      targetAuthorAci = $targetAuthorAci AND
      targetTimestamp = $targetTimestamp;`
    )
    .run({
      emoji,
      fromId,
      targetAuthorAci: targetAuthorServiceId,
      targetTimestamp,
    });
}

async function _getAllReactions(): Promise<Array<ReactionType>> {
  const db = getReadonlyInstance();
  return db.prepare<EmptyQuery>('SELECT * from reactions;').all();
}
async function _removeAllReactions(): Promise<void> {
  const db = await getWritableInstance();
  db.prepare<EmptyQuery>('DELETE from reactions;').run();
}

enum AdjacentDirection {
  Older = 'Older',
  Newer = 'Newer',
}

async function getRecentStoryReplies(
  storyId: string,
  options?: GetRecentStoryRepliesOptionsType
): Promise<Array<MessageTypeUnhydrated>> {
  return getRecentStoryRepliesSync(storyId, options);
}

// This function needs to pull story replies from all conversations, because when we send
//   a story to one or more distribution lists, each reply to it will be in the sender's
//   1:1 conversation with us.
function getRecentStoryRepliesSync(
  storyId: string,
  {
    limit = 100,
    messageId,
    receivedAt = Number.MAX_VALUE,
    sentAt = Number.MAX_VALUE,
  }: GetRecentStoryRepliesOptionsType = {}
): Array<MessageTypeUnhydrated> {
  const db = getReadonlyInstance();
  const timeFilters = {
    first: sqlFragment`received_at = ${receivedAt} AND sent_at < ${sentAt}`,
    second: sqlFragment`received_at < ${receivedAt}`,
  };

  const createQuery = (timeFilter: QueryFragment): QueryFragment => sqlFragment`
    SELECT json FROM messages WHERE
      (${messageId} IS NULL OR id IS NOT ${messageId}) AND
      isStory IS 0 AND
      storyId IS ${storyId} AND
      (
        ${timeFilter}
      )
      ORDER BY received_at DESC, sent_at DESC
  `;

  const template = sqlFragment`
    SELECT first.json FROM (${createQuery(timeFilters.first)}) as first
    UNION ALL
    SELECT second.json FROM (${createQuery(timeFilters.second)}) as second
  `;

  const [query, params] = sql`${template} LIMIT ${limit}`;

  return db.prepare(query).all(params);
}

function getAdjacentMessagesByConversationSync(
  direction: AdjacentDirection,
  {
    conversationId,
    includeStoryReplies,
    limit = 100,
    messageId,
    receivedAt = direction === AdjacentDirection.Older ? Number.MAX_VALUE : 0,
    sentAt = direction === AdjacentDirection.Older ? Number.MAX_VALUE : 0,
    requireVisualMediaAttachments,
    storyId,
  }: AdjacentMessagesByConversationOptionsType
): Array<MessageTypeUnhydrated> {
  const db = getReadonlyInstance();

  let timeFilters: { first: QueryFragment; second: QueryFragment };
  let timeOrder: QueryFragment;

  if (direction === AdjacentDirection.Older) {
    timeFilters = {
      first: sqlFragment`received_at = ${receivedAt} AND sent_at < ${sentAt}`,
      second: sqlFragment`received_at < ${receivedAt}`,
    };
    timeOrder = sqlFragment`DESC`;
  } else {
    timeFilters = {
      first: sqlFragment`received_at = ${receivedAt} AND sent_at > ${sentAt}`,
      second: sqlFragment`received_at > ${receivedAt}`,
    };
    timeOrder = sqlFragment`ASC`;
  }

  const requireDifferentMessage =
    direction === AdjacentDirection.Older || requireVisualMediaAttachments;

  const createQuery = (timeFilter: QueryFragment): QueryFragment => sqlFragment`
    SELECT json FROM messages WHERE
      conversationId = ${conversationId} AND
      ${
        requireDifferentMessage
          ? sqlFragment`(${messageId} IS NULL OR id IS NOT ${messageId}) AND`
          : sqlFragment``
      }
      ${
        requireVisualMediaAttachments
          ? sqlFragment`hasVisualMediaAttachments IS 1 AND`
          : sqlFragment``
      }
      isStory IS 0 AND
      (${_storyIdPredicate(storyId, includeStoryReplies)}) AND
      (
        ${timeFilter}
      )
      ORDER BY received_at ${timeOrder}, sent_at ${timeOrder}
  `;

  let template = sqlFragment`
    SELECT first.json FROM (${createQuery(timeFilters.first)}) as first
    UNION ALL
    SELECT second.json FROM (${createQuery(timeFilters.second)}) as second
  `;

  // See `filterValidAttachments` in ts/state/ducks/lightbox.ts
  if (requireVisualMediaAttachments) {
    template = sqlFragment`
      SELECT json
      FROM (${template}) as messages
      WHERE
        (
          SELECT COUNT(*)
          FROM json_each(messages.json ->> 'attachments') AS attachment
          WHERE
            attachment.value ->> 'thumbnail' IS NOT NULL AND
            attachment.value ->> 'pending' IS NOT 1 AND
            attachment.value ->> 'error' IS NULL
        ) > 0
      LIMIT ${limit};
    `;
  } else {
    template = sqlFragment`${template} LIMIT ${limit}`;
  }

  const [query, params] = sql`${template}`;

  const results = db.prepare(query).all(params);

  if (direction === AdjacentDirection.Older) {
    results.reverse();
  }

  return results;
}

async function getOlderMessagesByConversation(
  options: AdjacentMessagesByConversationOptionsType
): Promise<Array<MessageTypeUnhydrated>> {
  return getAdjacentMessagesByConversationSync(
    AdjacentDirection.Older,
    options
  );
}

async function getAllStories({
  conversationId,
  sourceServiceId,
}: {
  conversationId?: string;
  sourceServiceId?: ServiceIdString;
}): Promise<GetAllStoriesResultType> {
  const db = getReadonlyInstance();
  const rows: ReadonlyArray<{
    json: string;
    hasReplies: number;
    hasRepliesFromSelf: number;
  }> = db
    .prepare<Query>(
      `
      SELECT
        json,
        (SELECT EXISTS(
          SELECT 1
          FROM messages as replies
          WHERE replies.storyId IS messages.id
        )) as hasReplies,
        (SELECT EXISTS(
          SELECT 1
          FROM messages AS selfReplies
          WHERE
            selfReplies.storyId IS messages.id AND
            selfReplies.type IS 'outgoing'
        )) as hasRepliesFromSelf
      FROM messages
      WHERE
        type IS 'story' AND
        ($conversationId IS NULL OR conversationId IS $conversationId) AND
        ($sourceServiceId IS NULL OR sourceServiceId IS $sourceServiceId)
      ORDER BY received_at ASC, sent_at ASC;
      `
    )
    .all({
      conversationId: conversationId || null,
      sourceServiceId: sourceServiceId || null,
    });

  return rows.map(row => ({
    ...jsonToObject(row.json),
    hasReplies: row.hasReplies !== 0,
    hasRepliesFromSelf: row.hasRepliesFromSelf !== 0,
  }));
}

async function getNewerMessagesByConversation(
  options: AdjacentMessagesByConversationOptionsType
): Promise<Array<MessageTypeUnhydrated>> {
  return getAdjacentMessagesByConversationSync(
    AdjacentDirection.Newer,
    options
  );
}
function getOldestMessageForConversation(
  conversationId: string,
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): MessageMetricsType | undefined {
  const db = getReadonlyInstance();
  const [query, params] = sql`
    SELECT received_at, sent_at, id FROM messages WHERE
        conversationId = ${conversationId} AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, includeStoryReplies)})
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
  `;

  const row = db.prepare(query).get(params);

  if (!row) {
    return undefined;
  }

  return row;
}
function getNewestMessageForConversation(
  conversationId: string,
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): MessageMetricsType | undefined {
  const db = getReadonlyInstance();
  const [query, params] = sql`
    SELECT received_at, sent_at, id FROM messages WHERE
        conversationId = ${conversationId} AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, includeStoryReplies)})
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
  `;
  const row = db.prepare(query).get(params);

  if (!row) {
    return undefined;
  }

  return row;
}

export type GetMessagesBetweenOptions = Readonly<{
  after: { received_at: number; sent_at: number };
  before: { received_at: number; sent_at: number };
  includeStoryReplies: boolean;
}>;

async function getMessagesBetween(
  conversationId: string,
  options: GetMessagesBetweenOptions
): Promise<Array<string>> {
  const db = getReadonlyInstance();

  // In the future we could accept this as an option, but for now we just
  // use it for the story predicate.
  const storyId = undefined;

  const { after, before, includeStoryReplies } = options;

  const [query, params] = sql`
    SELECT id
    FROM messages
    WHERE
      conversationId = ${conversationId} AND
      (${_storyIdPredicate(storyId, includeStoryReplies)}) AND
      isStory IS 0 AND
      (
        received_at > ${after.received_at}
        OR (received_at = ${after.received_at} AND sent_at > ${after.sent_at})
      ) AND (
        received_at < ${before.received_at}
        OR (received_at = ${before.received_at} AND sent_at < ${before.sent_at})
      )
    ORDER BY received_at ASC, sent_at ASC;
  `;

  const rows = db.prepare(query).all(params);

  return rows.map(row => row.id);
}

/**
 * Given a set of deleted message IDs, find a message in the conversation that
 * is close to the set. Searching from the last selected message as a starting
 * point.
 */
async function getNearbyMessageFromDeletedSet({
  conversationId,
  lastSelectedMessage,
  deletedMessageIds,
  storyId,
  includeStoryReplies,
}: GetNearbyMessageFromDeletedSetOptionsType): Promise<string | null> {
  const db = getReadonlyInstance();

  function runQuery(after: boolean) {
    const dir = after ? sqlFragment`ASC` : sqlFragment`DESC`;
    const compare = after ? sqlFragment`>` : sqlFragment`<`;
    const { received_at, sent_at } = lastSelectedMessage;

    const [query, params] = sql`
      SELECT id FROM messages WHERE
        conversationId = ${conversationId} AND
        (${_storyIdPredicate(storyId, includeStoryReplies)}) AND
        isStory IS 0 AND
        id NOT IN (${sqlJoin(deletedMessageIds)}) AND
        type IN ('incoming', 'outgoing')
        AND (
          (received_at = ${received_at} AND sent_at ${compare} ${sent_at}) OR
          received_at ${compare} ${received_at}
        )
      ORDER BY received_at ${dir}, sent_at ${dir}
      LIMIT 1
    `;

    return db.prepare(query).pluck().get(params);
  }

  const after = runQuery(true);
  if (after != null) {
    return after;
  }

  const before = runQuery(false);
  if (before != null) {
    return before;
  }

  return null;
}

function getLastConversationActivity({
  conversationId,
  includeStoryReplies,
}: {
  conversationId: string;
  includeStoryReplies: boolean;
}): MessageType | undefined {
  const db = getReadonlyInstance();
  const row = prepare(
    db,
    `
      SELECT json FROM messages
      INDEXED BY messages_activity
      WHERE
        conversationId IS $conversationId AND
        shouldAffectActivity IS 1 AND
        isTimerChangeFromSync IS 0 AND
        ${includeStoryReplies ? '' : 'storyId IS NULL AND'}
        isGroupLeaveEventFromOther IS 0
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
      `
  ).get({
    conversationId,
  });

  if (!row) {
    return undefined;
  }

  return jsonToObject(row.json);
}
function getLastConversationPreview({
  conversationId,
  includeStoryReplies,
}: {
  conversationId: string;
  includeStoryReplies: boolean;
}): MessageType | undefined {
  type Row = Readonly<{
    json: string;
  }>;

  const db = getReadonlyInstance();

  const index = includeStoryReplies
    ? 'messages_preview'
    : 'messages_preview_without_story';

  const row: Row | undefined = prepare(
    db,
    `
      SELECT json FROM (
        SELECT json, expiresAt FROM messages
        INDEXED BY ${index}
        WHERE
          conversationId IS $conversationId AND
          shouldAffectPreview IS 1 AND
          isGroupLeaveEventFromOther IS 0
          ${includeStoryReplies ? '' : 'AND storyId IS NULL'}
        ORDER BY received_at DESC, sent_at DESC
      )
      WHERE likely(expiresAt > $now)
      LIMIT 1
    `
  ).get({
    conversationId,
    now: Date.now(),
  });

  return row ? jsonToObject(row.json) : undefined;
}

async function getConversationMessageStats({
  conversationId,
  includeStoryReplies,
}: {
  conversationId: string;
  includeStoryReplies: boolean;
}): Promise<ConversationMessageStatsType> {
  const db = getReadonlyInstance();

  return db.transaction(() => {
    return {
      activity: getLastConversationActivity({
        conversationId,
        includeStoryReplies,
      }),
      preview: getLastConversationPreview({
        conversationId,
        includeStoryReplies,
      }),
      hasUserInitiatedMessages: hasUserInitiatedMessages(conversationId),
    };
  })();
}

async function getLastConversationMessage({
  conversationId,
}: {
  conversationId: string;
}): Promise<MessageType | undefined> {
  const db = getReadonlyInstance();
  const row = db
    .prepare<Query>(
      `
      SELECT json FROM messages WHERE
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
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): MessageMetricsType | undefined {
  const db = getReadonlyInstance();

  const [query, params] = sql`
    SELECT received_at, sent_at, id FROM messages WHERE
      conversationId = ${conversationId} AND
      seenStatus = ${SeenStatus.Unseen} AND
      isStory IS 0 AND
      (${_storyIdPredicate(storyId, includeStoryReplies)})
    ORDER BY received_at ASC, sent_at ASC
    LIMIT 1;
  `;

  const row = db.prepare(query).get(params);

  if (!row) {
    return undefined;
  }

  return row;
}

async function getOldestUnreadMentionOfMeForConversation(
  conversationId: string,
  options: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): Promise<MessageMetricsType | undefined> {
  return getOldestUnreadMentionOfMeForConversationSync(conversationId, options);
}

export function getOldestUnreadMentionOfMeForConversationSync(
  conversationId: string,
  options: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): MessageMetricsType | undefined {
  const db = getReadonlyInstance();
  const [query, params] = sql`
      SELECT received_at, sent_at, id FROM messages WHERE
        conversationId = ${conversationId} AND
        readStatus = ${ReadStatus.Unread} AND
        mentionsMe IS 1 AND
        isStory IS 0 AND
        (${_storyIdPredicate(options.storyId, options.includeStoryReplies)})
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
      `;

  return db.prepare(query).get(params);
}

async function getTotalUnreadForConversation(
  conversationId: string,
  options: {
    storyId: string | undefined;
    includeStoryReplies: boolean;
  }
): Promise<number> {
  return getTotalUnreadForConversationSync(conversationId, options);
}
function getTotalUnreadForConversationSync(
  conversationId: string,
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId: string | undefined;
    includeStoryReplies: boolean;
  }
): number {
  const db = getReadonlyInstance();
  const [query, params] = sql`
    SELECT count(1)
    FROM messages
    WHERE
      conversationId = ${conversationId} AND
      readStatus = ${ReadStatus.Unread} AND
      isStory IS 0 AND
      (${_storyIdPredicate(storyId, includeStoryReplies)})
  `;
  const row = db.prepare(query).pluck().get(params);

  return row;
}
async function getTotalUnreadMentionsOfMeForConversation(
  conversationId: string,
  options: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): Promise<number> {
  return getTotalUnreadMentionsOfMeForConversationSync(conversationId, options);
}
function getTotalUnreadMentionsOfMeForConversationSync(
  conversationId: string,
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): number {
  const db = getReadonlyInstance();
  const [query, params] = sql`
    SELECT count(1)
    FROM messages
    WHERE
      conversationId = ${conversationId} AND
      readStatus = ${ReadStatus.Unread} AND
      mentionsMe IS 1 AND
      isStory IS 0 AND
      (${_storyIdPredicate(storyId, includeStoryReplies)})
  `;
  const row = db.prepare(query).pluck().get(params);

  return row;
}
function getTotalUnseenForConversationSync(
  conversationId: string,
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): number {
  const db = getReadonlyInstance();
  const [query, params] = sql`
    SELECT count(1)
      FROM messages
      WHERE
        conversationId = ${conversationId} AND
        seenStatus = ${SeenStatus.Unseen} AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, includeStoryReplies)})
  `;
  const row = db.prepare(query).pluck().get(params);

  return row;
}

async function getMessageMetricsForConversation(options: {
  conversationId: string;
  storyId?: string;
  includeStoryReplies: boolean;
}): Promise<ConversationMetricsType> {
  return getMessageMetricsForConversationSync(options);
}
function getMessageMetricsForConversationSync(options: {
  conversationId: string;
  storyId?: string;
  includeStoryReplies: boolean;
}): ConversationMetricsType {
  const { conversationId } = options;
  const oldest = getOldestMessageForConversation(conversationId, options);
  const newest = getNewestMessageForConversation(conversationId, options);
  const oldestUnseen = getOldestUnseenMessageForConversation(
    conversationId,
    options
  );
  const totalUnseen = getTotalUnseenForConversationSync(
    conversationId,
    options
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

async function getConversationRangeCenteredOnMessage(
  options: AdjacentMessagesByConversationOptionsType
): Promise<
  GetConversationRangeCenteredOnMessageResultType<MessageTypeUnhydrated>
> {
  const db = getReadonlyInstance();

  return db.transaction(() => {
    return {
      older: getAdjacentMessagesByConversationSync(
        AdjacentDirection.Older,
        options
      ),
      newer: getAdjacentMessagesByConversationSync(
        AdjacentDirection.Newer,
        options
      ),
      metrics: getMessageMetricsForConversationSync(options),
    };
  })();
}

async function getAllCallHistory(): Promise<ReadonlyArray<CallHistoryDetails>> {
  const db = getReadonlyInstance();
  const [query] = sql`
    SELECT * FROM callsHistory;
  `;
  return db.prepare(query).all();
}

async function clearCallHistory(
  beforeTimestamp: number
): Promise<Array<string>> {
  const db = await getWritableInstance();
  return db.transaction(() => {
    const whereMessages = sqlFragment`
      WHERE messages.type IS 'call-history'
      AND messages.sent_at <= ${beforeTimestamp};
    `;

    const [selectMessagesQuery, selectMessagesParams] = sql`
      SELECT id FROM messages ${whereMessages}
    `;
    const [clearMessagesQuery, clearMessagesParams] = sql`
      DELETE FROM messages ${whereMessages}
    `;
    const [clearCallsHistoryQuery, clearCallsHistoryParams] = sql`
      UPDATE callsHistory
      SET
        status = ${DirectCallStatus.Deleted},
        timestamp = ${Date.now()}
      WHERE callsHistory.timestamp <= ${beforeTimestamp};
    `;

    const messageIds = db
      .prepare(selectMessagesQuery)
      .pluck()
      .all(selectMessagesParams);
    db.prepare(clearMessagesQuery).run(clearMessagesParams);
    try {
      db.prepare(clearCallsHistoryQuery).run(clearCallsHistoryParams);
    } catch (error) {
      logger.error(error, error.message);
      throw error;
    }

    return messageIds;
  })();
}

async function cleanupCallHistoryMessages(): Promise<void> {
  const db = await getWritableInstance();
  return db
    .transaction(() => {
      const [query, params] = sql`
        DELETE FROM messages
        WHERE messages.id IN (
          SELECT messages.id FROM messages
          LEFT JOIN callsHistory ON callsHistory.callId IS messages.callId
          WHERE messages.type IS 'call-history'
          AND callsHistory.status IS ${CALL_STATUS_DELETED}
        )
      `;
      db.prepare(query).run(params);
    })
    .immediate();
}

async function getCallHistoryMessageByCallId(options: {
  conversationId: string;
  callId: string;
}): Promise<MessageType | undefined> {
  const db = getReadonlyInstance();
  const [query, params] = sql`
    SELECT json
    FROM messages
    WHERE conversationId = ${options.conversationId}
      AND type = 'call-history'
      AND callId = ${options.callId}
  `;
  const row = db.prepare(query).get(params);
  if (row == null) {
    return;
  }
  return jsonToObject(row.json);
}

async function getCallHistory(
  callId: string,
  peerId: ServiceIdString | string
): Promise<CallHistoryDetails | undefined> {
  const db = getReadonlyInstance();

  const [query, params] = sql`
    SELECT * FROM callsHistory
    WHERE callId IS ${callId}
    AND peerId IS ${peerId};
  `;

  const row = db.prepare(query).get(params);

  if (row == null) {
    return;
  }

  return callHistoryDetailsSchema.parse(row);
}

const READ_STATUS_UNREAD = sqlConstant(ReadStatus.Unread);
const READ_STATUS_READ = sqlConstant(ReadStatus.Read);
const CALL_STATUS_MISSED = sqlConstant(DirectCallStatus.Missed);
const CALL_STATUS_DELETED = sqlConstant(DirectCallStatus.Deleted);
const CALL_STATUS_INCOMING = sqlConstant(CallDirection.Incoming);
const FOUR_HOURS_IN_MS = sqlConstant(4 * 60 * 60 * 1000);

async function getCallHistoryUnreadCount(): Promise<number> {
  const db = getReadonlyInstance();
  const [query, params] = sql`
    SELECT count(*) FROM messages
    LEFT JOIN callsHistory ON callsHistory.callId = messages.callId
    WHERE messages.type IS 'call-history'
      AND messages.readStatus IS ${READ_STATUS_UNREAD}
      AND callsHistory.status IS ${CALL_STATUS_MISSED}
      AND callsHistory.direction IS ${CALL_STATUS_INCOMING}
  `;
  const row = db.prepare(query).pluck().get(params);
  return row;
}

async function markCallHistoryRead(callId: string): Promise<void> {
  const db = await getWritableInstance();
  const [query, params] = sql`
    UPDATE messages
    SET readStatus = ${READ_STATUS_READ}
    WHERE type IS 'call-history'
    AND callId IS ${callId}
  `;
  db.prepare(query).run(params);
}

async function markAllCallHistoryRead(): Promise<ReadonlyArray<string>> {
  const db = await getWritableInstance();

  return db.transaction(() => {
    const where = sqlFragment`
      WHERE messages.type IS 'call-history'
        AND messages.readStatus IS ${READ_STATUS_UNREAD}
    `;

    const [selectQuery, selectParams] = sql`
      SELECT DISTINCT conversationId
      FROM messages
      ${where};
    `;

    const conversationIds = db.prepare(selectQuery).pluck().all(selectParams);

    const [updateQuery, updateParams] = sql`
      UPDATE messages
      SET readStatus = ${READ_STATUS_READ}
      ${where};
    `;

    db.prepare(updateQuery).run(updateParams);

    return conversationIds;
  })();
}

function getCallHistoryGroupDataSync(
  db: Database,
  isCount: boolean,
  filter: CallHistoryFilter,
  pagination: CallHistoryPagination
): unknown {
  return db.transaction(() => {
    const { limit, offset } = pagination;
    const { status, conversationIds } = filter;

    if (conversationIds != null) {
      strictAssert(conversationIds.length > 0, "can't filter by empty array");

      const [createTempTable] = sql`
        CREATE TEMP TABLE temp_callHistory_filtered_conversations (
          id TEXT,
          serviceId TEXT,
          groupId TEXT
        );
      `;

      db.exec(createTempTable);

      batchMultiVarQuery(db, conversationIds, ids => {
        const idList = sqlJoin(ids.map(id => sqlFragment`${id}`));

        const [insertQuery, insertParams] = sql`
          INSERT INTO temp_callHistory_filtered_conversations
            (id, serviceId, groupId)
          SELECT id, serviceId, groupId
          FROM conversations
          WHERE conversations.id IN (${idList});
        `;

        db.prepare(insertQuery).run(insertParams);
      });
    }

    const innerJoin =
      conversationIds != null
        ? // peerId can be a conversation id (legacy), a serviceId, or a groupId
          sqlFragment`
            INNER JOIN temp_callHistory_filtered_conversations ON (
              temp_callHistory_filtered_conversations.id IS c.peerId
              OR temp_callHistory_filtered_conversations.serviceId IS c.peerId
              OR temp_callHistory_filtered_conversations.groupId IS c.peerId
            )
          `
        : sqlFragment``;

    const filterClause =
      status === CallHistoryFilterStatus.All
        ? sqlFragment`status IS NOT ${CALL_STATUS_DELETED}`
        : sqlFragment`
            direction IS ${CALL_STATUS_INCOMING} AND
            status IS ${CALL_STATUS_MISSED} AND status IS NOT ${CALL_STATUS_DELETED}
          `;

    const offsetLimit =
      limit > 0 ? sqlFragment`LIMIT ${limit} OFFSET ${offset}` : sqlFragment``;

    const projection = isCount
      ? sqlFragment`COUNT(*) AS count`
      : sqlFragment`peerId, ringerId, mode, type, direction, status, timestamp, possibleChildren, inPeriod`;

    const [query, params] = sql`
      SELECT
        ${projection}
      FROM (
        -- 1. 'callAndGroupInfo': This section collects metadata to determine the
        -- parent and children of each call. We can identify the real parents of calls
        -- within the query, but we need to build the children at runtime.
        WITH callAndGroupInfo AS (
          SELECT
            *,
            -- 1a. 'possibleParent': This identifies the first call that _could_ be
            -- considered the current call's parent. Note: The 'possibleParent' is not
            -- necessarily the true parent if there is another call between them that
            -- isn't a part of the group.
            (
              SELECT callId
              FROM callsHistory
              WHERE
                callsHistory.direction IS c.direction
                AND callsHistory.type IS c.type
                AND callsHistory.peerId IS c.peerId
                AND (callsHistory.timestamp - ${FOUR_HOURS_IN_MS}) <= c.timestamp
                AND callsHistory.timestamp >= c.timestamp
                -- Tracking Android & Desktop separately to make the queries easier to compare
                -- Android Constraints:
                AND (
                  (callsHistory.status IS c.status AND callsHistory.status IS ${CALL_STATUS_MISSED}) OR
                  (callsHistory.status IS NOT ${CALL_STATUS_MISSED} AND c.status IS NOT ${CALL_STATUS_MISSED})
                )
                -- Desktop Constraints:
                AND callsHistory.status IS c.status
                AND ${filterClause}
              ORDER BY timestamp DESC
            ) as possibleParent,
            -- 1b. 'possibleChildren': This identifies all possible calls that can
            -- be grouped with the current call. Note: This current call is not
            -- necessarily the parent, and not all possible children will end up as
            -- children as they might have another parent
            (
              SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT(
                  'callId', callId,
                  'timestamp', timestamp
                )
              )
              FROM callsHistory
              WHERE
                callsHistory.direction IS c.direction
                AND callsHistory.type IS c.type
                AND callsHistory.peerId IS c.peerId
                AND (c.timestamp - ${FOUR_HOURS_IN_MS}) <= callsHistory.timestamp
                AND c.timestamp >= callsHistory.timestamp
                -- Tracking Android & Desktop separately to make the queries easier to compare
                -- Android Constraints:
                AND (
                  (callsHistory.status IS c.status AND callsHistory.status IS ${CALL_STATUS_MISSED}) OR
                  (callsHistory.status IS NOT ${CALL_STATUS_MISSED} AND c.status IS NOT ${CALL_STATUS_MISSED})
                )
                -- Desktop Constraints:
                AND callsHistory.status IS c.status
                AND ${filterClause}
              ORDER BY timestamp DESC
            ) as possibleChildren,

            -- 1c. 'inPeriod': This identifies all calls in a time period after the
            -- current call. They may or may not be a part of the group.
            (
              SELECT GROUP_CONCAT(callId)
              FROM callsHistory
              WHERE
                (c.timestamp - ${FOUR_HOURS_IN_MS}) <= callsHistory.timestamp
                AND c.timestamp >= callsHistory.timestamp
                AND ${filterClause}
            ) AS inPeriod
          FROM callsHistory AS c
          ${innerJoin}
          WHERE
            ${filterClause}
          ORDER BY timestamp DESC
        )
        -- 2. 'isParent': We need to identify the true parent of the group in cases
        -- where the previous call is not a part of the group.
        SELECT
          *,
          CASE
            WHEN LAG (possibleParent, 1, 0) OVER (
              -- Note: This is an optimization assuming that we've already got 'timestamp DESC' ordering
              -- from the query above. If we find that ordering isn't always correct, we can uncomment this:
              -- ORDER BY timestamp DESC
            ) != possibleParent THEN callId
            ELSE possibleParent
          END AS parent
        FROM callAndGroupInfo
      ) AS parentCallAndGroupInfo
      WHERE parent = parentCallAndGroupInfo.callId
      ORDER BY parentCallAndGroupInfo.timestamp DESC
      ${offsetLimit};
    `;

    const result = isCount
      ? db.prepare(query).pluck(true).get(params)
      : db.prepare(query).all(params);

    if (conversationIds != null) {
      const [dropTempTableQuery] = sql`
        DROP TABLE temp_callHistory_filtered_conversations;
      `;

      db.exec(dropTempTableQuery);
    }

    return result;
  })();
}

const countSchema = z.number().int().nonnegative();

async function getCallHistoryGroupsCount(
  filter: CallHistoryFilter
): Promise<number> {
  // getCallHistoryGroupDataSync creates a temporary table and thus requires
  // write access.
  const db = getUnsafeWritableInstance('only temp table use');
  const result = getCallHistoryGroupDataSync(db, true, filter, {
    limit: 0,
    offset: 0,
  });
  return countSchema.parse(result);
}

const groupsDataSchema = z.array(
  callHistoryGroupSchema.omit({ children: true }).extend({
    possibleChildren: z.string(),
    inPeriod: z.string(),
  })
);

const possibleChildrenSchema = z.array(
  callHistoryDetailsSchema.pick({
    callId: true,
    timestamp: true,
  })
);

async function getCallHistoryGroups(
  filter: CallHistoryFilter,
  pagination: CallHistoryPagination
): Promise<Array<CallHistoryGroup>> {
  // getCallHistoryGroupDataSync creates a temporary table and thus requires
  // write access.
  const db = getUnsafeWritableInstance('only temp table use');
  const groupsData = groupsDataSchema.parse(
    getCallHistoryGroupDataSync(db, false, filter, pagination)
  );

  const taken = new Set<string>();

  return groupsData
    .map(groupData => {
      return {
        ...groupData,
        possibleChildren: possibleChildrenSchema.parse(
          JSON.parse(groupData.possibleChildren)
        ),
        inPeriod: new Set(groupData.inPeriod.split(',')),
      };
    })
    .reverse()
    .map(group => {
      const { possibleChildren, inPeriod, ...rest } = group;
      const children = [];

      for (const child of possibleChildren) {
        if (!taken.has(child.callId) && inPeriod.has(child.callId)) {
          children.push(child);
          taken.add(child.callId);
        }
      }

      return callHistoryGroupSchema.parse({ ...rest, children });
    })
    .reverse();
}

async function saveCallHistory(callHistory: CallHistoryDetails): Promise<void> {
  const db = await getWritableInstance();

  const [insertQuery, insertParams] = sql`
    INSERT OR REPLACE INTO callsHistory (
      callId,
      peerId,
      ringerId,
      mode,
      type,
      direction,
      status,
      timestamp
    ) VALUES (
      ${callHistory.callId},
      ${callHistory.peerId},
      ${callHistory.ringerId},
      ${callHistory.mode},
      ${callHistory.type},
      ${callHistory.direction},
      ${callHistory.status},
      ${callHistory.timestamp}
    );
  `;

  db.prepare(insertQuery).run(insertParams);
}

async function hasGroupCallHistoryMessage(
  conversationId: string,
  eraId: string
): Promise<boolean> {
  const db = getReadonlyInstance();

  const exists: number = db
    .prepare<Query>(
      `
      SELECT EXISTS(
        SELECT 1 FROM messages
        WHERE conversationId = $conversationId
        AND type = 'call-history'
        AND json_extract(json, '$.callHistoryDetails.callMode') = 'Group'
        AND json_extract(json, '$.callHistoryDetails.eraId') = $eraId
      );
      `
    )
    .pluck()
    .get({
      conversationId,
      eraId,
    });

  return exists !== 0;
}

async function migrateConversationMessages(
  obsoleteId: string,
  currentId: string
): Promise<void> {
  const db = await getWritableInstance();

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
  const db = getReadonlyInstance();

  const [query, params] = sql`
      SELECT messages.json, received_at, sent_at FROM edited_messages
      INNER JOIN messages ON
        messages.id = edited_messages.messageId
      WHERE edited_messages.sentAt = ${sentAt}
      UNION
      SELECT json, received_at, sent_at FROM messages
      WHERE sent_at = ${sentAt}
      ORDER BY messages.received_at DESC, messages.sent_at DESC;
    `;

  const rows = db.prepare(query).all(params);

  return rows.map(row => jsonToObject(row.json));
}

async function getExpiredMessages(): Promise<Array<MessageType>> {
  const db = getReadonlyInstance();
  const now = Date.now();

  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json FROM messages WHERE
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
  const db = getReadonlyInstance();
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
  const db = getReadonlyInstance();

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

  if (result != null && result >= Number.MAX_SAFE_INTEGER) {
    return undefined;
  }

  return result || undefined;
}

async function getNextTapToViewMessageTimestampToAgeOut(): Promise<
  undefined | number
> {
  const db = getReadonlyInstance();
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
  const db = getReadonlyInstance();
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

const MAX_UNPROCESSED_ATTEMPTS = 10;

function saveUnprocessedSync(db: Database, data: UnprocessedType): string {
  const {
    id,
    timestamp,
    receivedAtCounter,
    version,
    attempts,
    envelope,
    source,
    sourceServiceId,
    sourceDevice,
    serverGuid,
    serverTimestamp,
    decrypted,
    urgent,
    story,
  } = data;
  if (!id) {
    throw new Error('saveUnprocessedSync: id was falsey');
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
      sourceServiceId,
      sourceDevice,
      serverGuid,
      serverTimestamp,
      decrypted,
      urgent,
      story
    ) values (
      $id,
      $timestamp,
      $receivedAtCounter,
      $version,
      $attempts,
      $envelope,
      $source,
      $sourceServiceId,
      $sourceDevice,
      $serverGuid,
      $serverTimestamp,
      $decrypted,
      $urgent,
      $story
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
    sourceServiceId: sourceServiceId || null,
    sourceDevice: sourceDevice || null,
    serverGuid: serverGuid || null,
    serverTimestamp: serverTimestamp || null,
    decrypted: decrypted || null,
    urgent: urgent || !isBoolean(urgent) ? 1 : 0,
    story: story ? 1 : 0,
  });

  return id;
}

function updateUnprocessedWithDataSync(
  db: Database,
  id: string,
  data: UnprocessedUpdateType
): void {
  const {
    source,
    sourceServiceId,
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
      sourceServiceId = $sourceServiceId,
      sourceDevice = $sourceDevice,
      serverGuid = $serverGuid,
      serverTimestamp = $serverTimestamp,
      decrypted = $decrypted
    WHERE id = $id;
    `
  ).run({
    id,
    source: source || null,
    sourceServiceId: sourceServiceId || null,
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
  const db = await getWritableInstance();
  return updateUnprocessedWithDataSync(db, id, data);
}

async function updateUnprocessedsWithData(
  arrayOfUnprocessed: Array<{ id: string; data: UnprocessedUpdateType }>
): Promise<void> {
  const db = await getWritableInstance();

  db.transaction(() => {
    for (const { id, data } of arrayOfUnprocessed) {
      assertSync(updateUnprocessedWithDataSync(db, id, data));
    }
  })();
}

async function getUnprocessedById(
  id: string
): Promise<UnprocessedType | undefined> {
  const db = getReadonlyInstance();
  const row = db
    .prepare<Query>('SELECT * FROM unprocessed WHERE id = $id;')
    .get({
      id,
    });

  return {
    ...row,
    urgent: isNumber(row.urgent) ? Boolean(row.urgent) : true,
    story: Boolean(row.story),
  };
}

async function getUnprocessedCount(): Promise<number> {
  return getCountFromTable(getReadonlyInstance(), 'unprocessed');
}

async function getAllUnprocessedIds(): Promise<Array<string>> {
  log.info('getAllUnprocessedIds');
  const db = await getWritableInstance();

  return db.transaction(() => {
    // cleanup first
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
          SELECT id
          FROM unprocessed
          ORDER BY receivedAtCounter ASC
        `
      )
      .pluck()
      .all();
  })();
}

async function getUnprocessedByIdsAndIncrementAttempts(
  ids: ReadonlyArray<string>
): Promise<Array<UnprocessedType>> {
  log.info('getUnprocessedByIdsAndIncrementAttempts', { totalIds: ids.length });

  const db = await getWritableInstance();

  batchMultiVarQuery(db, ids, batch => {
    return db
      .prepare<ArrayQuery>(
        `
          UPDATE unprocessed
          SET attempts = attempts + 1
          WHERE id IN (${batch.map(() => '?').join(', ')})
        `
      )
      .run(batch);
  });

  return batchMultiVarQuery(db, ids, batch => {
    return db
      .prepare<ArrayQuery>(
        `
          SELECT *
          FROM unprocessed
          WHERE id IN (${batch.map(() => '?').join(', ')})
          ORDER BY receivedAtCounter ASC;
        `
      )
      .all(batch)
      .map(row => ({
        ...row,
        urgent: isNumber(row.urgent) ? Boolean(row.urgent) : true,
        story: Boolean(row.story),
      }));
  });
}

function removeUnprocessedsSync(
  db: Database,
  ids: ReadonlyArray<string>
): void {
  log.info('removeUnprocessedsSync', { totalIds: ids.length });
  db.prepare<ArrayQuery>(
    `
    DELETE FROM unprocessed
    WHERE id IN ( ${ids.map(() => '?').join(', ')} );
    `
  ).run(ids);
}

function removeUnprocessedSync(db: Database, id: string | Array<string>): void {
  log.info('removeUnprocessedSync', { id });
  if (!Array.isArray(id)) {
    prepare(db, 'DELETE FROM unprocessed WHERE id = $id;').run({ id });

    return;
  }

  // This can happen normally due to flushing of `cacheRemoveBatcher` in
  // MessageReceiver.
  if (!id.length) {
    return;
  }

  assertSync(
    batchMultiVarQuery(db, id, batch => removeUnprocessedsSync(db, batch))
  );
}

async function removeUnprocessed(id: string | Array<string>): Promise<void> {
  const db = await getWritableInstance();

  removeUnprocessedSync(db, id);
}

async function removeAllUnprocessed(): Promise<void> {
  const db = await getWritableInstance();
  db.prepare<EmptyQuery>('DELETE FROM unprocessed;').run();
}

// Attachment Downloads

const ATTACHMENT_DOWNLOADS_TABLE = 'attachment_downloads';
async function getAttachmentDownloadJobById(
  id: string
): Promise<AttachmentDownloadJobType | undefined> {
  return getById(getReadonlyInstance(), ATTACHMENT_DOWNLOADS_TABLE, id);
}
async function getNextAttachmentDownloadJobs(
  limit?: number,
  options: { timestamp?: number } = {}
): Promise<Array<AttachmentDownloadJobType>> {
  const db = await getWritableInstance();
  const timestamp =
    options && options.timestamp ? options.timestamp : Date.now();

  const rows: Array<{ json: string; id: string }> = db
    .prepare<Query>(
      `
      SELECT id, json
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

  const INNER_ERROR = 'jsonToObject error';
  try {
    return rows.map(row => {
      try {
        return jsonToObject(row.json);
      } catch (error) {
        logger.error(
          `getNextAttachmentDownloadJobs: Error with job '${row.id}', deleting. ` +
            `JSON: '${row.json}' ` +
            `Error: ${Errors.toLogFormat(error)}`
        );
        removeAttachmentDownloadJobSync(db, row.id);
        throw new Error(INNER_ERROR);
      }
    });
  } catch (error) {
    if ('message' in error && error.message === INNER_ERROR) {
      return getNextAttachmentDownloadJobs(limit, { timestamp });
    }
    throw error;
  }
}
async function saveAttachmentDownloadJob(
  job: AttachmentDownloadJobType
): Promise<void> {
  const db = await getWritableInstance();
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
  const db = await getWritableInstance();
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
  const db = await getWritableInstance();
  db.prepare<EmptyQuery>(
    `
    UPDATE attachment_downloads
    SET pending = 0
    WHERE pending != 0;
    `
  ).run();
}
function removeAttachmentDownloadJobSync(db: Database, id: string): number {
  return removeById(db, ATTACHMENT_DOWNLOADS_TABLE, id);
}
async function removeAttachmentDownloadJob(id: string): Promise<number> {
  const db = await getWritableInstance();
  return removeAttachmentDownloadJobSync(db, id);
}
async function removeAllAttachmentDownloadJobs(): Promise<number> {
  return removeAllFromTable(
    await getWritableInstance(),
    ATTACHMENT_DOWNLOADS_TABLE
  );
}

// Stickers

async function createOrUpdateStickerPack(pack: StickerPackType): Promise<void> {
  const db = await getWritableInstance();
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
  db: Database,
  id: string,
  status: StickerPackStatusType,
  options?: { timestamp: number }
): void {
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
  const db = await getWritableInstance();
  return updateStickerPackStatusSync(db, id, status, options);
}
async function updateStickerPackInfo({
  id,
  storageID,
  storageVersion,
  storageUnknownFields,
  storageNeedsSync,
  uninstalledAt,
}: StickerPackInfoType): Promise<void> {
  const db = await getWritableInstance();

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
  const db = await getWritableInstance();

  db.prepare<EmptyQuery>(
    `
    UPDATE sticker_packs
    SET downloadAttempts = 0
    WHERE status = 'error';
    `
  ).run();
}
async function createOrUpdateSticker(sticker: StickerType): Promise<void> {
  const db = await getWritableInstance();
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
  const db = await getWritableInstance();
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
  const db = await getWritableInstance();

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
  const db = await getWritableInstance();

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

      const count = db
        .prepare<Query>(
          `
          SELECT count(1) FROM sticker_references
          WHERE packId = $packId;
          `
        )
        .pluck()
        .get({ packId });
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
  const db = await getWritableInstance();

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
  return getCountFromTable(getReadonlyInstance(), 'stickers');
}
async function getAllStickerPacks(): Promise<Array<StickerPackType>> {
  const db = getReadonlyInstance();

  const rows = db
    .prepare<EmptyQuery>(
      `
      SELECT * FROM sticker_packs
      ORDER BY position ASC, id ASC
      `
    )
    .all();

  return rows.map(row => {
    return {
      ...row,
      // The columns have STRING type so if they have numeric value, sqlite
      // will return integers.
      author: String(row.author),
      title: String(row.title),
    };
  });
}
function addUninstalledStickerPackSync(
  db: Database,
  pack: UninstalledStickerPackType
): void {
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
  const db = await getWritableInstance();
  return addUninstalledStickerPackSync(db, pack);
}
function removeUninstalledStickerPackSync(db: Database, packId: string): void {
  db.prepare<Query>(
    'DELETE FROM uninstalled_sticker_packs WHERE id IS $id'
  ).run({ id: packId });
}
async function removeUninstalledStickerPack(packId: string): Promise<void> {
  const db = await getWritableInstance();
  return removeUninstalledStickerPackSync(db, packId);
}
async function getUninstalledStickerPacks(): Promise<
  Array<UninstalledStickerPackType>
> {
  const db = getReadonlyInstance();

  const rows = db
    .prepare<EmptyQuery>(
      'SELECT * FROM uninstalled_sticker_packs ORDER BY id ASC'
    )
    .all();

  return rows || [];
}
async function getInstalledStickerPacks(): Promise<Array<StickerPackType>> {
  const db = getReadonlyInstance();

  // If sticker pack has a storageID - it is being downloaded and about to be
  // installed so we better sync it back to storage service if asked.
  const rows = db
    .prepare<EmptyQuery>(
      `
      SELECT *
      FROM sticker_packs
      WHERE
        status IS 'installed' OR
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
  const db = getReadonlyInstance();

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
  const db = await getWritableInstance();
  return db.transaction(() => {
    const status = 'installed';
    updateStickerPackStatusSync(db, packId, status, { timestamp });

    removeUninstalledStickerPackSync(db, packId);
  })();
}
async function uninstallStickerPack(
  packId: string,
  timestamp: number
): Promise<void> {
  const db = await getWritableInstance();
  return db.transaction(() => {
    const status = 'downloaded';
    updateStickerPackStatusSync(db, packId, status);

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

    addUninstalledStickerPackSync(db, {
      id: packId,
      uninstalledAt: timestamp,
      storageNeedsSync: true,
    });
  })();
}
async function getAllStickers(): Promise<Array<StickerType>> {
  const db = getReadonlyInstance();

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
  const db = getReadonlyInstance();

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
  const db = await getWritableInstance();

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
  const db = getReadonlyInstance();
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
  const db = getReadonlyInstance();

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
  const db = await getWritableInstance();

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
  const db = await getWritableInstance();
  prepare<Query>(
    db,
    'UPDATE badgeImageFiles SET localPath = $localPath WHERE url = $url'
  ).run({ url, localPath });
}

async function getAllBadgeImageFileLocalPaths(): Promise<Set<string>> {
  const db = getReadonlyInstance();
  const localPaths = db
    .prepare<EmptyQuery>(
      'SELECT localPath FROM badgeImageFiles WHERE localPath IS NOT NULL'
    )
    .pluck()
    .all();
  return new Set(localPaths);
}

function runCorruptionChecks(): void {
  let db: Database;
  try {
    db = getUnsafeWritableInstance('integrity check');
  } catch (error) {
    logger.error(
      'runCorruptionChecks: not running the check, no writable instance',
      Errors.toLogFormat(error)
    );
    return;
  }
  try {
    const result = db.pragma('integrity_check');
    if (result.length === 1 && result.at(0)?.integrity_check === 'ok') {
      logger.info('runCorruptionChecks: general integrity is ok');
    } else {
      logger.error('runCorruptionChecks: general integrity is not ok', result);
    }
  } catch (error) {
    logger.error(
      'runCorruptionChecks: general integrity check error',
      Errors.toLogFormat(error)
    );
  }
  try {
    db.exec("INSERT INTO messages_fts(messages_fts) VALUES('integrity-check')");
    logger.info('runCorruptionChecks: FTS5 integrity ok');
  } catch (error) {
    logger.error(
      'runCorruptionChecks: FTS5 integrity check error.',
      Errors.toLogFormat(error)
    );
  }
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
  const db = getReadonlyInstance();
  const storyDistributions = db
    .prepare<EmptyQuery>('SELECT * FROM storyDistributions;')
    .all();

  return storyDistributions.map(hydrateStoryDistribution);
}
async function _getAllStoryDistributionMembers(): Promise<
  Array<StoryDistributionMemberType>
> {
  const db = getReadonlyInstance();
  return db
    .prepare<EmptyQuery>('SELECT * FROM storyDistributionMembers;')
    .all();
}
async function _deleteAllStoryDistributions(): Promise<void> {
  const db = await getWritableInstance();
  db.prepare<EmptyQuery>('DELETE FROM storyDistributions;').run();
}
async function createNewStoryDistribution(
  distribution: StoryDistributionWithMembersType
): Promise<void> {
  strictAssert(
    distribution.name,
    'Distribution list does not have a valid name'
  );

  const db = await getWritableInstance();

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
        serviceId
      ) VALUES (
        $listId,
        $serviceId
      );
      `
    );

    for (const serviceId of members) {
      memberInsertStatement.run({
        listId,
        serviceId,
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
    members: (byListId[list.id] || []).map(member => member.serviceId),
  }));
}
async function getStoryDistributionWithMembers(
  id: string
): Promise<StoryDistributionWithMembersType | undefined> {
  const db = getReadonlyInstance();
  const storyDistribution: StoryDistributionForDatabase | undefined = prepare(
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
    ...hydrateStoryDistribution(storyDistribution),
    members: members.map(({ serviceId }) => serviceId),
  };
}
function modifyStoryDistributionSync(
  db: Database,
  payload: StoryDistributionForDatabase
): void {
  if (payload.deletedAtTimestamp) {
    strictAssert(
      !payload.name,
      'Attempt to delete distribution list but still has a name'
    );
  } else {
    strictAssert(
      payload.name,
      'Cannot clear distribution list name without deletedAtTimestamp set'
    );
  }

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
  }: { toAdd: Array<ServiceIdString>; toRemove: Array<ServiceIdString> }
) {
  const memberInsertStatement = prepare(
    db,
    `
    INSERT OR REPLACE INTO storyDistributionMembers (
      listId,
      serviceId
    ) VALUES (
      $listId,
      $serviceId
    );
    `
  );

  for (const serviceId of toAdd) {
    memberInsertStatement.run({
      listId,
      serviceId,
    });
  }

  batchMultiVarQuery(
    db,
    toRemove,
    (serviceIds: ReadonlyArray<ServiceIdString>) => {
      const serviceIdSet = sqlJoin(serviceIds);
      const [sqlQuery, sqlParams] = sql`
        DELETE FROM storyDistributionMembers
        WHERE listId = ${listId} AND serviceId IN (${serviceIdSet});
      `;
      db.prepare(sqlQuery).run(sqlParams);
    }
  );
}
async function modifyStoryDistributionWithMembers(
  distribution: StoryDistributionType,
  {
    toAdd,
    toRemove,
  }: { toAdd: Array<ServiceIdString>; toRemove: Array<ServiceIdString> }
): Promise<void> {
  const payload = freezeStoryDistribution(distribution);
  const db = await getWritableInstance();

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
  const db = await getWritableInstance();
  modifyStoryDistributionSync(db, payload);
}
async function modifyStoryDistributionMembers(
  listId: string,
  {
    toAdd,
    toRemove,
  }: { toAdd: Array<ServiceIdString>; toRemove: Array<ServiceIdString> }
): Promise<void> {
  const db = await getWritableInstance();

  db.transaction(() => {
    modifyStoryDistributionMembersSync(db, listId, { toAdd, toRemove });
  })();
}
async function deleteStoryDistribution(
  id: StoryDistributionIdString
): Promise<void> {
  const db = await getWritableInstance();
  db.prepare<Query>('DELETE FROM storyDistributions WHERE id = $id;').run({
    id,
  });
}

async function _getAllStoryReads(): Promise<Array<StoryReadType>> {
  const db = getReadonlyInstance();
  return db.prepare<EmptyQuery>('SELECT * FROM storyReads;').all();
}
async function _deleteAllStoryReads(): Promise<void> {
  const db = await getWritableInstance();
  db.prepare<EmptyQuery>('DELETE FROM storyReads;').run();
}
async function addNewStoryRead(read: StoryReadType): Promise<void> {
  const db = await getWritableInstance();

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
  authorId: ServiceIdString;
  conversationId?: string;
  limit?: number;
}): Promise<Array<StoryReadType>> {
  const limit = initialLimit || 5;

  const db = getReadonlyInstance();
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
  const db = getReadonlyInstance();
  return db
    .prepare<Query>(
      `
      SELECT count(1) FROM storyReads
      WHERE conversationId = $conversationId;
      `
    )
    .pluck()
    .get({ conversationId });
}

// All data in database
async function removeAll(): Promise<void> {
  const db = await getWritableInstance();

  db.transaction(() => {
    db.exec(`
      --- Remove messages delete trigger for performance
      DROP   TRIGGER messages_on_delete;

      DELETE FROM attachment_downloads;
      DELETE FROM badgeImageFiles;
      DELETE FROM badges;
      DELETE FROM callsHistory;
      DELETE FROM conversations;
      DELETE FROM emojis;
      DELETE FROM groupCallRingCancellations;
      DELETE FROM identityKeys;
      DELETE FROM items;
      DELETE FROM jobs;
      DELETE FROM kyberPreKeys;
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
      DELETE FROM uninstalled_sticker_packs;

      INSERT INTO messages_fts(messages_fts) VALUES('optimize');

      --- Re-create the messages delete trigger
      --- See migration 45
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
    `);
  })();
}

// Anything that isn't user-visible data
async function removeAllConfiguration(): Promise<void> {
  const db = await getWritableInstance();

  db.transaction(() => {
    db.exec(
      `
      DELETE FROM identityKeys;
      DELETE FROM jobs;
      DELETE FROM kyberPreKeys;
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

    db.exec(
      `
      UPDATE conversations SET json = json_remove(json, '$.senderKeyInfo');
      UPDATE storyDistributions SET senderKeyInfoJson = NULL;
      `
    );
  })();
}

async function eraseStorageServiceState(): Promise<void> {
  const db = await getWritableInstance();

  db.exec(`
    -- Conversations
    UPDATE conversations
    SET
      json = json_remove(json, '$.storageID', '$.needsStorageServiceSync', '$.storageUnknownFields');

    -- Stickers
    UPDATE sticker_packs
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0;

    UPDATE uninstalled_sticker_packs
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0;

    -- Story Distribution Lists
    UPDATE storyDistributions
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0;
  `);
}

const MAX_MESSAGE_MIGRATION_ATTEMPTS = 5;

async function getMessagesNeedingUpgrade(
  limit: number,
  { maxVersion }: { maxVersion: number }
): Promise<Array<MessageType>> {
  const db = getReadonlyInstance();

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
  const db = getReadonlyInstance();
  const rows: JSONRows = db
    .prepare<Query>(
      `
      SELECT json FROM messages
      INDEXED BY messages_hasVisualMediaAttachments
      WHERE
        isStory IS 0 AND
        storyId IS NULL AND
        conversationId = $conversationId AND
        -- Note that this check has to use 'IS' to utilize
        -- 'messages_hasVisualMediaAttachments' INDEX
        hasVisualMediaAttachments IS 1
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
  const db = getReadonlyInstance();
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
  const db = getReadonlyInstance();

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

async function getKnownMessageAttachments(
  cursor?: MessageAttachmentsCursorType
): Promise<GetKnownMessageAttachmentsResultType> {
  const db = await getWritableInstance();
  const result = new Set<string>();
  const chunkSize = 1000;

  return db.transaction(() => {
    let count = cursor?.count ?? 0;

    strictAssert(
      !cursor?.done,
      'getKnownMessageAttachments: iteration cannot be restarted'
    );

    let runId: string;
    if (cursor === undefined) {
      runId = randomBytes(8).toString('hex');

      const total = getMessageCountSync();
      logger.info(
        `getKnownMessageAttachments(${runId}): ` +
          `Starting iteration through ${total} messages`
      );

      db.exec(
        `
        CREATE TEMP TABLE tmp_${runId}_updated_messages
          (rowid INTEGER PRIMARY KEY ASC);

        INSERT INTO tmp_${runId}_updated_messages (rowid)
        SELECT rowid FROM messages;

        CREATE TEMP TRIGGER tmp_${runId}_message_updates
        UPDATE OF json ON messages
        BEGIN
          INSERT OR IGNORE INTO tmp_${runId}_updated_messages (rowid)
          VALUES (NEW.rowid);
        END;

        CREATE TEMP TRIGGER tmp_${runId}_message_inserts
        AFTER INSERT ON messages
        BEGIN
          INSERT OR IGNORE INTO tmp_${runId}_updated_messages (rowid)
          VALUES (NEW.rowid);
        END;
        `
      );
    } else {
      ({ runId } = cursor);
    }

    const rowids: Array<number> = db
      .prepare<Query>(
        `
      DELETE FROM tmp_${runId}_updated_messages
      RETURNING rowid
      LIMIT $chunkSize;
      `
      )
      .pluck()
      .all({ chunkSize });

    const messages = batchMultiVarQuery(
      db,
      rowids,
      (batch: ReadonlyArray<number>): Array<MessageType> => {
        const query = db.prepare<ArrayQuery>(
          `SELECT json FROM messages WHERE rowid IN (${Array(batch.length)
            .fill('?')
            .join(',')});`
        );
        const rows: JSONRows = query.all(batch);
        return rows.map(row => jsonToObject(row.json));
      }
    );

    for (const message of messages) {
      const externalFiles = getExternalFilesForMessage(message);
      forEach(externalFiles, file => result.add(file));
      count += 1;
    }

    const done = rowids.length < chunkSize;
    return {
      attachments: Array.from(result),
      cursor: { runId, count, done },
    };
  })();
}

async function finishGetKnownMessageAttachments({
  runId,
  count,
  done,
}: MessageAttachmentsCursorType): Promise<void> {
  const db = await getWritableInstance();

  const logId = `finishGetKnownMessageAttachments(${runId})`;
  if (!done) {
    logger.warn(`${logId}: iteration not finished`);
  }

  logger.info(`${logId}: reached the end after processing ${count} messages`);
  db.exec(`
    DROP TABLE tmp_${runId}_updated_messages;
    DROP TRIGGER tmp_${runId}_message_updates;
    DROP TRIGGER tmp_${runId}_message_inserts;
  `);
}

async function getKnownConversationAttachments(): Promise<Array<string>> {
  const db = getReadonlyInstance();
  const result = new Set<string>();
  const chunkSize = 500;

  let complete = false;
  let id = '';

  const conversationTotal = await getConversationCount();
  logger.info(
    'getKnownConversationAttachments: About to iterate through ' +
      `${conversationTotal}`
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
      externalFiles.forEach(file => result.add(file));
    });

    const lastMessage: ConversationType | undefined = last(conversations);
    if (lastMessage) {
      ({ id } = lastMessage);
    }
    complete = conversations.length < chunkSize;
  }

  logger.info('getKnownConversationAttachments: Done processing');

  return Array.from(result);
}

async function removeKnownStickers(
  allStickers: ReadonlyArray<string>
): Promise<Array<string>> {
  const db = await getWritableInstance();
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
  allStickers: ReadonlyArray<string>
): Promise<Array<string>> {
  const db = await getWritableInstance();
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

const OPTIMIZE_FTS_PAGE_COUNT = 64;

// This query is incremental. It gets the `state` from the return value of
// previous `optimizeFTS` call. When `state.done` is `true` - optimization is
// complete.
async function optimizeFTS(
  state?: FTSOptimizationStateType
): Promise<FTSOptimizationStateType | undefined> {
  // See https://www.sqlite.org/fts5.html#the_merge_command
  let pageCount = OPTIMIZE_FTS_PAGE_COUNT;
  if (state === undefined) {
    pageCount = -pageCount;
  }
  const db = await getWritableInstance();
  const getChanges = prepare(db, 'SELECT total_changes() as changes;', {
    pluck: true,
  });

  const changeDifference = db.transaction(() => {
    const before: number = getChanges.get({});

    prepare(
      db,
      `
        INSERT INTO messages_fts(messages_fts, rank) VALUES ('merge', $pageCount);
      `
    ).run({ pageCount });

    const after: number = getChanges.get({});

    return after - before;
  })();

  const nextSteps = (state?.steps ?? 0) + 1;

  // From documentation:
  // "If the difference is less than 2, then the 'merge' command was a no-op"
  const done = changeDifference < 2;

  return { steps: nextSteps, done };
}

async function getJobsInQueue(queueType: string): Promise<Array<StoredJob>> {
  const db = getReadonlyInstance();
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
  const db = await getWritableInstance();
  return insertJobSync(db, job);
}

async function deleteJob(id: string): Promise<void> {
  const db = await getWritableInstance();

  db.prepare<Query>('DELETE FROM jobs WHERE id = $id').run({ id });
}

async function wasGroupCallRingPreviouslyCanceled(
  ringId: bigint
): Promise<boolean> {
  const db = getReadonlyInstance();

  return db
    .prepare<Query>(
      `
      SELECT EXISTS (
        SELECT 1 FROM groupCallRingCancellations
        WHERE ringId = $ringId
        AND createdAt >= $ringsOlderThanThisAreIgnored
      );
      `
    )
    .pluck()
    .get({
      ringId,
      ringsOlderThanThisAreIgnored: Date.now() - MAX_GROUP_CALL_RING_AGE,
    });
}

async function processGroupCallRingCancellation(ringId: bigint): Promise<void> {
  const db = await getWritableInstance();

  db.prepare<Query>(
    `
    INSERT INTO groupCallRingCancellations (ringId, createdAt)
    VALUES ($ringId, $createdAt)
    ON CONFLICT (ringId) DO NOTHING;
    `
  ).run({ ringId, createdAt: Date.now() });
}

// This age, in milliseconds, should be longer than any group call ring duration. Beyond
//   that, it doesn't really matter what the value is.
const MAX_GROUP_CALL_RING_AGE = 30 * durations.MINUTE;

async function cleanExpiredGroupCallRingCancellations(): Promise<void> {
  const db = await getWritableInstance();

  db.prepare<Query>(
    `
    DELETE FROM groupCallRingCancellations
    WHERE createdAt < $expiredRingTime;
    `
  ).run({
    expiredRingTime: Date.now() - MAX_GROUP_CALL_RING_AGE,
  });
}

async function getMaxMessageCounter(): Promise<number | undefined> {
  const db = getReadonlyInstance();

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
  const db = getReadonlyInstance();
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
  const db = await getWritableInstance();

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
  const db = await getWritableInstance();

  db.exec(
    `
    UPDATE conversations
    SET
      json = json_remove(json, '$.profileKeyCredential')
    `
  );
}

async function saveEditedMessage(
  mainMessage: MessageType,
  ourAci: AciString,
  { conversationId, messageId, readStatus, sentAt }: EditedMessageType
): Promise<void> {
  const db = await getWritableInstance();

  db.transaction(() => {
    assertSync(
      saveMessageSync(db, mainMessage, {
        ourAci,
        alreadyInTransaction: true,
      })
    );

    const [query, params] = sql`
      INSERT INTO edited_messages (
        conversationId,
        messageId,
        sentAt,
        readStatus
      ) VALUES (
        ${conversationId},
        ${messageId},
        ${sentAt},
        ${readStatus}
      );
    `;

    db.prepare(query).run(params);
  })();
}

async function _getAllEditedMessages(): Promise<
  Array<{ messageId: string; sentAt: number }>
> {
  const db = getReadonlyInstance();

  return db
    .prepare<Query>(
      `
      SELECT * FROM edited_messages;
      `
    )
    .all({});
}

async function getUnreadEditedMessagesAndMarkRead({
  conversationId,
  newestUnreadAt,
}: {
  conversationId: string;
  newestUnreadAt: number;
}): Promise<GetUnreadByConversationAndMarkReadResultType> {
  const db = await getWritableInstance();

  return db.transaction(() => {
    const [selectQuery, selectParams] = sql`
      SELECT
        messages.id,
        messages.json,
        edited_messages.sentAt,
        edited_messages.readStatus
      FROM edited_messages
      JOIN messages
        ON messages.id = edited_messages.messageId
      WHERE
        edited_messages.readStatus = ${ReadStatus.Unread} AND
        edited_messages.conversationId = ${conversationId} AND
        received_at <= ${newestUnreadAt}
      ORDER BY messages.received_at DESC, messages.sent_at DESC;
    `;

    const rows = db.prepare(selectQuery).all(selectParams);

    if (rows.length) {
      const newestSentAt = rows[0].sentAt;

      const [updateStatusQuery, updateStatusParams] = sql`
        UPDATE edited_messages
          SET
            readStatus = ${ReadStatus.Read}
          WHERE
            readStatus = ${ReadStatus.Unread} AND
            conversationId = ${conversationId} AND
            sentAt <= ${newestSentAt};
      `;

      db.prepare(updateStatusQuery).run(updateStatusParams);
    }

    return rows.map(row => {
      const json = jsonToObject<MessageType>(row.json);
      return {
        originalReadStatus: row.readStatus,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        ...pick(json, [
          'expirationStartTimestamp',
          'id',
          'sent_at',
          'source',
          'sourceServiceId',
          'type',
        ]),
        // Use the edited message timestamp
        sent_at: row.sentAt,
      };
    });
  })();
}
