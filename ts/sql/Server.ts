// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

// TODO(indutny): format queries
import type { RowType } from '@signalapp/sqlcipher';
import SQL, { setLogger as setSqliteLogger } from '@signalapp/sqlcipher';
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { ReadonlyDeep } from 'type-fest';
import { z } from 'zod';

import type { Dictionary } from 'lodash';
import lodash from 'lodash';

import { parseBadgeCategory } from '../badges/BadgeCategory.std.js';
import {
  parseBadgeImageTheme,
  type BadgeImageTheme,
} from '../badges/BadgeImageTheme.std.js';
import type { BadgeImageType, BadgeType } from '../badges/types.std.js';
import type { StoredJob } from '../jobs/types.std.js';
import { formatCountForLogging } from '../logging/formatCountForLogging.std.js';
import { ReadStatus } from '../messages/MessageReadStatus.std.js';
import type {
  GroupV2MemberType,
  MessageAttributesType,
} from '../model-types.d.ts';
import type { ReactionType } from '../types/Reactions.std.js';
import { ReactionReadStatus } from '../types/Reactions.std.js';
import type { AciString, ServiceIdString } from '../types/ServiceId.std.js';
import { isServiceIdString } from '../types/ServiceId.std.js';
import { STORAGE_UI_KEYS } from '../types/StorageUIKeys.std.js';
import type { StoryDistributionIdString } from '../types/StoryDistributionId.std.js';
import * as Errors from '../types/errors.std.js';
import { assertDev, strictAssert } from '../util/assert.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { combineNames } from '../util/combineNames.std.js';
import { consoleLogger } from '../util/consoleLogger.std.js';
import {
  dropNull,
  shallowConvertUndefinedToNull,
  type ShallowNullToUndefined,
  type ShallowUndefinedToNull,
} from '../util/dropNull.std.js';
import { isNormalNumber } from '../util/isNormalNumber.std.js';
import { isNotNil } from '../util/isNotNil.std.js';
import { parseIntOrThrow } from '../util/parseIntOrThrow.std.js';
import { updateSchema } from './migrations/index.node.js';
import type { JSONRows } from './util.std.js';
import {
  batchMultiVarQuery,
  bulkAdd,
  createOrUpdate,
  getAllFromTable,
  getById,
  getCountFromTable,
  getSchemaVersion,
  getUserVersion,
  jsonToObject,
  objectToJSON,
  removeAllFromTable,
  removeById,
  setUserVersion,
  sql,
  sqlConstant,
  sqlFragment,
  sqlJoin,
  QueryFragment,
  convertOptionalBooleanToInteger,
} from './util.std.js';
import {
  hydrateMessage,
  hydrateMessages,
  convertAttachmentDBFieldsToAttachmentType,
  getAttachmentReferencesForMessages,
  ROOT_MESSAGE_ATTACHMENT_EDIT_HISTORY_INDEX,
} from './hydration.std.js';

import { SeenStatus } from '../MessageSeenStatus.std.js';
import {
  attachmentBackupJobSchema,
  type AttachmentBackupJobType,
} from '../types/AttachmentBackup.std.js';
import {
  attachmentDownloadJobSchema,
  type MessageAttachmentType,
  type AttachmentDownloadJobType,
} from '../types/AttachmentDownload.std.js';
import type {
  CallHistoryDetails,
  CallHistoryFilter,
  CallHistoryGroup,
  CallHistoryPagination,
  CallLogEventTarget,
} from '../types/CallDisposition.std.js';
import {
  CallDirection,
  CallHistoryFilterStatus,
  CallMode,
  CallStatusValue,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
  callHistoryDetailsSchema,
  callHistoryGroupSchema,
} from '../types/CallDisposition.std.js';
import { redactGenericText } from '../util/privacy.node.js';
import {
  parseLoose,
  parseStrict,
  parseUnknown,
  safeParseUnknown,
} from '../util/schemas.std.js';
import {
  SNIPPET_LEFT_PLACEHOLDER,
  SNIPPET_RIGHT_PLACEHOLDER,
  SNIPPET_TRUNCATION_PLACEHOLDER,
} from '../util/search.std.js';
import type { SyncTaskType } from '../util/syncTasks.preload.js';
import { MAX_SYNC_TASK_ATTEMPTS } from '../util/syncTasks.types.std.js';
import type {
  AdjacentMessagesByConversationOptionsType,
  BackupCdnMediaObjectType,
  ConversationMessageStatsType,
  ConversationMetricsType,
  ConversationType,
  DeleteSentProtoRecipientOptionsType,
  DeleteSentProtoRecipientResultType,
  EditedMessageType,
  EmojiType,
  GetAllStoriesResultType,
  GetConversationRangeCenteredOnMessageResultType,
  GetKnownMessageAttachmentsResultType,
  GetNearbyMessageFromDeletedSetOptionsType,
  GetOlderMediaOptionsType,
  GetRecentStoryRepliesOptionsType,
  GetUnreadByConversationAndMarkReadResultType,
  IdentityKeyIdType,
  ItemKeyType,
  KyberPreKeyTripleType,
  MediaItemDBType,
  MessageAttachmentsCursorType,
  MessageCursorType,
  MessageMetricsType,
  MessageType,
  PageMessagesCursorType,
  PageMessagesResultType,
  PreKeyIdType,
  ReactionResultType,
  ReadableDB,
  SenderKeyIdType,
  SenderKeyType,
  SentMessageDBType,
  SentMessagesType,
  SentProtoDBType,
  SentProtoType,
  SentProtoWithMessageIdsType,
  SentRecipientsDBType,
  SentRecipientsType,
  ServerReadableInterface,
  ServerSearchResultMessageType,
  ServerWritableInterface,
  SessionIdType,
  SessionType,
  SignedPreKeyIdType,
  StickerPackInfoType,
  StickerPackStatusType,
  StickerPackRefType,
  StickerPackType,
  StickerType,
  StoredAllItemsType,
  StoredIdentityKeyType,
  StoredItemType,
  StoredKyberPreKeyType,
  StoredPreKeyType,
  StoredSignedPreKeyType,
  StoryDistributionMemberType,
  StoryDistributionType,
  StoryDistributionWithMembersType,
  StoryReadType,
  UninstalledStickerPackType,
  UnprocessedType,
  WritableDB,
  MessageAttachmentDBType,
  MessageTypeUnhydrated,
  ServerMessageSearchResultType,
  MessageCountBySchemaVersionType,
  BackupAttachmentDownloadProgress,
  GetMessagesBetweenOptions,
  MaybeStaleCallHistory,
} from './Interface.std.js';
import {
  AttachmentDownloadSource,
  MESSAGE_COLUMNS,
  MESSAGE_ATTACHMENT_COLUMNS,
  MESSAGE_NON_PRIMARY_KEY_COLUMNS,
} from './Interface.std.js';
import {
  _removeAllCallLinks,
  beginDeleteAllCallLinks,
  beginDeleteCallLink,
  callLinkExists,
  defunctCallLinkExists,
  deleteCallHistoryByRoomId,
  deleteCallLinkAndHistory,
  deleteCallLinkFromSync,
  finalizeDeleteCallLink,
  getAllAdminCallLinks,
  getAllCallLinkRecordsWithAdminKey,
  getAllCallLinks,
  getAllDefunctCallLinksWithAdminKey,
  getAllMarkedDeletedCallLinkRoomIds,
  getCallLinkByRoomId,
  getCallLinkRecordByRoomId,
  insertCallLink,
  insertDefunctCallLink,
  insertOrUpdateCallLinkFromSync,
  updateCallLink,
  updateCallLinkState,
  updateCallLinkStateAndEpoch,
  updateDefunctCallLink,
} from './server/callLinks.node.js';
import {
  _deleteAllDonationReceipts,
  createDonationReceipt,
  deleteDonationReceiptById,
  getAllDonationReceipts,
  getDonationReceiptById,
} from './server/donationReceipts.std.js';
import {
  deleteAllEndorsementsForGroup,
  getGroupSendCombinedEndorsementExpiration,
  getGroupSendEndorsementsData,
  getGroupSendMemberEndorsement,
  replaceAllEndorsementsForGroup,
} from './server/groupSendEndorsements.std.js';
import {
  getAllChatFolders,
  getCurrentChatFolders,
  getChatFolder,
  createChatFolder,
  hasAllChatsChatFolder,
  createAllChatsChatFolder,
  upsertAllChatsChatFolderFromSync,
  updateChatFolder,
  markChatFolderDeleted,
  getOldestDeletedChatFolder,
  updateChatFolderPositions,
  updateChatFolderDeletedAtTimestampMsFromSync,
  deleteExpiredChatFolders,
} from './server/chatFolders.std.js';
import { INITIAL_EXPIRE_TIMER_VERSION } from '../util/expirationTimer.std.js';
import type { GifType } from '../components/fun/panels/FunPanelGifs.dom.js';
import type { NotificationProfileType } from '../types/NotificationProfile.std.js';
import * as durations from '../util/durations/index.std.js';
import type { AttachmentType } from '../types/Attachment.std.js';
import { isFile, isVisualMedia } from '../util/Attachment.std.js';
import { generateMessageId } from '../util/generateMessageId.node.js';
import type {
  ConversationColorType,
  CustomColorType,
} from '../types/Colors.std.js';
import { sqlLogger } from './sqlLogger.node.js';
import { permissiveMessageAttachmentSchema } from './server/messageAttachments.std.js';
import { getFilePathsOwnedByMessage } from '../util/messageFilePaths.std.js';

const {
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
  noop,
  omit,
  partition,
  pick,
} = lodash;

type ConversationRow = Readonly<{
  json: string;
  profileLastFetchedAt: null | number;
  expireTimerVersion: number;
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
  version: 1 | 2;
  localKey: string | null;
  size: number | null;
}>;
type StorageServiceRowFields = Readonly<{
  storageID?: string;
  storageVersion?: number;
  storageUnknownFields?: Uint8Array | null;
  storageNeedsSync: number;
}>;
type InstalledStickerPackRow = Readonly<{
  id: string;
  key: string;

  position?: number | null;
}> &
  StorageServiceRowFields;
type UninstalledStickerPackRow = Readonly<{
  id: string;

  uninstalledAt: number;
}> &
  StorageServiceRowFields;
type StickerPackRow = InstalledStickerPackRow &
  Readonly<{
    attemptedStatus?: 'downloaded' | 'installed' | 'ephemeral';
    author: string;
    coverStickerId: number;
    createdAt: number;
    downloadAttempts: number;
    installedAt?: number;
    lastUsed?: number;
    status: StickerPackStatusType;
    stickerCount: number;
    stickers: string;
    title: string;
  }>;

const ATTACHMENT_DOWNLOADS_COLUMNS: ReadonlyArray<
  | keyof Omit<AttachmentDownloadJobType, 'attachment' | 'isManualDownload'>
  | 'attachmentJson'
> = [
  'messageId',
  'attachmentType',
  'attachmentSignature',
  'receivedAt',
  'sentAt',
  'contentType',
  'size',
  'active',
  'attempts',
  'retryAfter',
  'lastAttemptTimestamp',
  'attachmentJson',
  'ciphertextSize',
  'originalSource',
  'source',
] as const;

type AttachmentDownloadJobRow = Omit<
  ShallowUndefinedToNull<AttachmentDownloadJobType>,
  // TODO: DESKTOP-8995
  'attachment' | 'contentType' | 'active' | 'isManualDownload'
> & {
  attachmentJson: string;
  contentType: string;
  active: 0 | 1;
};

// Because we can't force this module to conform to an interface, we narrow our exports
//   to this one default export, which does conform to the interface.
// Note: In Javascript, you need to access the .default property when requiring it
// https://github.com/microsoft/TypeScript/issues/420
export const DataReader: ServerReadableInterface = {
  close: closeReadable,

  getIdentityKeyById,
  getAllIdentityKeys,

  getKyberPreKeyById,
  getAllKyberPreKeys,

  getPreKeyById,
  getAllPreKeys,

  getSignedPreKeyById,
  getAllSignedPreKeys,

  getItemById,
  getAllItems,

  getSenderKeyById,
  getAllSenderKeys,

  getAllSentProtos,
  _getAllSentProtoRecipients,
  _getAllSentProtoMessageIds,

  getAllSessions,

  getAllKyberTriples,

  getConversationCount,
  getConversationById,

  getAllConversations,
  getAllConversationIds,

  getGroupSendCombinedEndorsementExpiration,
  getGroupSendEndorsementsData,
  getGroupSendMemberEndorsement,

  searchMessages,

  getMessageCount,
  getStoryCount,
  getRecentStoryReplies,
  countStoryReadsByConversation,
  getReactionByTimestamp,
  _getAllReactions,
  getMessageBySender,
  getMessageById,
  getMessagesById,
  _getAllMessages,
  _getAllEditedMessages,
  getAllMessageIds,
  getMessagesBySentAt,
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
  getCallHistoryUnreadCount,
  getCallHistoryMessageByCallId,
  getCallHistory,
  getCallHistoryGroupsCount,
  getCallHistoryGroups,
  hasGroupCallHistoryMessage,

  hasMedia,
  getOlderMedia,

  getAllNotificationProfiles,
  getNotificationProfileById,

  getAllDonationReceipts,
  getDonationReceiptById,

  getAllChatFolders,
  getCurrentChatFolders,
  getChatFolder,
  hasAllChatsChatFolder,
  getOldestDeletedChatFolder,

  callLinkExists,
  defunctCallLinkExists,
  getAllCallLinks,
  getCallLinkByRoomId,
  getCallLinkRecordByRoomId,
  getAllAdminCallLinks,
  getAllCallLinkRecordsWithAdminKey,
  getAllDefunctCallLinksWithAdminKey,
  getAllMarkedDeletedCallLinkRoomIds,
  getMessagesBetween,
  getNearbyMessageFromDeletedSet,
  getMostRecentAddressableMessages,
  getMostRecentAddressableNondisappearingMessages,
  getUnprocessedCount,
  _getAttachmentDownloadJob,

  getStickerCount,
  getAllStickerPacks,
  getInstalledStickerPacks,
  getUninstalledStickerPacks,
  getStickerPackInfo,
  getAllStickers,
  getRecentStickers,
  getRecentEmojis,
  getRecentGifs,

  getAllBadges,
  getAllBadgeImageFileLocalPaths,
  getAllStoryDistributionsWithMembers,
  getStoryDistributionWithMembers,
  _getAllStoryDistributions,
  _getAllStoryDistributionMembers,
  _getAllStoryReads,
  getLastStoryReadsForAuthor,
  getMessagesNeedingUpgrade,
  getMessageServerGuidsForSpam,

  getJobsInQueue,
  wasGroupCallRingPreviouslyCanceled,
  getMaxMessageCounter,

  getStatisticsForLogging,

  getBackupCdnObjectMetadata,
  getBackupAttachmentDownloadProgress,
  getAttachmentReferencesForMessages,
  getMessageCountBySchemaVersion,
  getMessageSampleForSchemaVersion,

  // Server-only
  getKnownMessageAttachments,
  finishGetKnownMessageAttachments,
  pageMessages,
  finishPageMessages,
  getKnownDownloads,
  getKnownConversationAttachments,

  __dangerouslyRunAbitraryReadOnlySqlQuery,
};

export const DataWriter: ServerWritableInterface = {
  close: closeWritable,
  removeIndexedDBFiles,

  createOrUpdateIdentityKey,
  bulkAddIdentityKeys,
  removeIdentityKeyById,
  removeAllIdentityKeys,

  createOrUpdateKyberPreKey,
  bulkAddKyberPreKeys,
  removeKyberPreKeyById,
  removeKyberPreKeysByServiceId,
  removeAllKyberPreKeys,

  createOrUpdatePreKey,
  bulkAddPreKeys,
  removePreKeyById,
  removePreKeysByServiceId,
  removeAllPreKeys,

  createOrUpdateSignedPreKey,
  bulkAddSignedPreKeys,
  removeSignedPreKeyById,
  removeSignedPreKeysByServiceId,
  removeAllSignedPreKeys,

  createOrUpdateItem,
  removeItemById,
  removeAllItems,

  createOrUpdateSenderKey,
  removeAllSenderKeys,
  removeSenderKeyById,

  insertSentProto,
  deleteSentProtosOlderThan,
  deleteSentProtoByMessageId,
  insertProtoRecipients,
  deleteSentProtoRecipient,
  removeAllSentProtos,
  getSentProtoByRecipient,

  createOrUpdateSession,
  createOrUpdateSessions,
  commitDecryptResult,
  removeSessionById,
  removeSessionsByConversation,
  removeSessionsByServiceId,
  removeAllSessions,

  saveConversation,
  saveConversations,
  updateConversation,
  updateConversations,
  removeConversation,
  _removeAllConversations,
  updateAllConversationColors,
  removeAllProfileKeyCredentials,
  getUnreadByConversationAndMarkRead,
  getUnreadReactionsAndMarkRead,

  replaceAllEndorsementsForGroup,
  deleteAllEndorsementsForGroup,

  saveMessage,
  saveMessages,
  saveMessagesIndividually,
  removeMessage,
  removeMessages,
  markReactionAsRead,
  addReaction,
  removeReactionFromConversation,
  _removeAllReactions,
  _removeAllMessages,
  _removeMessage: removeMessage,
  getUnreadEditedMessagesAndMarkRead,
  clearCallHistory,
  _removeAllCallHistory,
  markCallHistoryDeleted,
  cleanupCallHistoryMessages,
  markCallHistoryRead,
  markAllCallHistoryRead,
  markAllCallHistoryReadInConversation,
  saveCallHistory,
  markCallHistoryMissed,
  insertCallLink,
  insertOrUpdateCallLinkFromSync,
  updateCallLink,
  updateCallLinkState,
  updateCallLinkStateAndEpoch,
  beginDeleteAllCallLinks,
  beginDeleteCallLink,
  deleteCallHistoryByRoomId,
  deleteCallLinkAndHistory,
  finalizeDeleteCallLink,
  _removeAllCallLinks,
  deleteCallLinkFromSync,
  insertDefunctCallLink,
  updateDefunctCallLink,
  migrateConversationMessages,
  saveEditedMessage,
  saveEditedMessages,
  incrementMessagesMigrationAttempts,

  removeSyncTaskById,
  removeSyncTasks,
  saveSyncTasks,
  incrementAllSyncTaskAttempts,
  dequeueOldestSyncTasks,

  getUnprocessedByIdsAndIncrementAttempts,
  getAllUnprocessedIds,
  removeUnprocessed,
  removeAllUnprocessed,

  getNextAttachmentDownloadJobs,
  saveAttachmentDownloadJob,
  saveAttachmentDownloadJobs,
  resetAttachmentDownloadActive,
  resetBackupAttachmentDownloadJobsRetryAfter,
  removeAttachmentDownloadJob,
  removeAttachmentDownloadJobsForMessage,
  removeAllBackupAttachmentDownloadJobs,
  resetBackupAttachmentDownloadStats,

  getNextAttachmentBackupJobs,
  saveAttachmentBackupJob,
  markAllAttachmentBackupJobsInactive,
  removeAttachmentBackupJob,
  clearAllAttachmentBackupJobs,

  clearAllBackupCdnObjectMetadata,
  saveBackupCdnObjectMetadata,

  createOrUpdateStickerPack,
  createOrUpdateStickerPacks,
  updateStickerPackStatus,
  updateStickerPackInfo,
  createOrUpdateSticker,
  createOrUpdateStickers,
  updateStickerLastUsed,
  addStickerPackReference,
  deleteStickerPackReference,
  deleteStickerPack,
  getUnresolvedStickerPackReferences,
  addUninstalledStickerPack,
  addUninstalledStickerPacks,
  installStickerPack,
  uninstallStickerPack,
  clearAllErrorStickerPackAttempts,

  updateEmojiUsage,

  addRecentGif,
  removeRecentGif,

  updateOrCreateBadges,
  badgeImageFileDownloaded,

  getRecentStaleRingsAndMarkOlderMissed,

  _deleteAllStoryDistributions,
  createNewStoryDistribution,
  modifyStoryDistribution,
  modifyStoryDistributionMembers,
  modifyStoryDistributionWithMembers,
  deleteStoryDistribution,

  _deleteAllStoryReads,
  addNewStoryRead,

  _deleteAllNotificationProfiles,
  createNotificationProfile,
  deleteNotificationProfileById,
  markNotificationProfileDeleted,
  updateNotificationProfile,

  _deleteAllDonationReceipts,
  deleteDonationReceiptById,
  createDonationReceipt,

  createChatFolder,
  createAllChatsChatFolder,
  upsertAllChatsChatFolderFromSync,
  updateChatFolder,
  markChatFolderDeleted,
  deleteExpiredChatFolders,
  updateChatFolderPositions,
  updateChatFolderDeletedAtTimestampMsFromSync,

  removeAll,
  removeAllConfiguration,
  eraseStorageServiceState,

  insertJob,
  deleteJob,

  processGroupCallRingCancellation,
  cleanExpiredGroupCallRingCancellations,

  disableMessageInsertTriggers,
  enableMessageInsertTriggersAndBackfill,
  ensureMessageInsertTriggersAreEnabled,

  disableFSync,
  enableFSyncAndCheckpoint,

  _testOnlyRemoveMessageAttachments,

  // Server-only

  removeKnownStickers,
  removeKnownDraftAttachments,
  runCorruptionChecks,
};

const MESSAGE_COLUMNS_FRAGMENTS = MESSAGE_COLUMNS.map(
  column => new QueryFragment(column, [])
);

function rowToConversation(row: ConversationRow): ConversationType {
  const { expireTimerVersion } = row;
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
    expireTimerVersion,
    profileLastFetchedAt,
  };
}

function rowToSticker(row: StickerRow): StickerType {
  return {
    ...row,
    isCoverOnly: Boolean(row.isCoverOnly),
    emoji: dropNull(row.emoji),
    version: row.version || 1,
    localKey: dropNull(row.localKey),
    size: dropNull(row.size),
  };
}

function keyDatabase(db: WritableDB, key: string): void {
  // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
  db.pragma(`key = "x'${key}'"`);
}

function switchToWAL(db: WritableDB): void {
  // https://sqlite.org/wal.html
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
}

function migrateSchemaVersion(db: WritableDB): void {
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

function openAndMigrateDatabase(filePath: string, key: string): WritableDB {
  let db: WritableDB | undefined;

  // First, we try to open the database without any cipher changes
  try {
    db = new SQL(filePath, {
      cacheStatements: true,
    }) as WritableDB;
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
  db = new SQL(filePath) as WritableDB;
  try {
    keyDatabase(db, key);

    // https://www.zetetic.net/blog/2018/11/30/sqlcipher-400-release/#compatability-sqlcipher-4-0-0
    db.pragma('cipher_compatibility = 3');
    migrateSchemaVersion(db);
    db.close();

    // After migrating user_version -> schema_version, we reopen database, because
    // we can't migrate to the latest ciphers after we've modified the defaults.
    db = new SQL(filePath) as WritableDB;
    keyDatabase(db, key);

    db.pragma('cipher_migrate');
    switchToWAL(db);
  } catch (error) {
    try {
      db.close();
    } catch {
      // Best effort
    }
    throw error;
  }

  return db;
}

const INVALID_KEY = /[^0-9A-Fa-f]/;
function openAndSetUpSQLCipher(filePath: string, { key }: { key: string }) {
  const match = INVALID_KEY.exec(key);
  if (match) {
    throw new Error(`setupSQLCipher: key '${key}' is not valid`);
  }

  const db = openAndMigrateDatabase(filePath, key);

  try {
    // Because foreign key support is not enabled by default!
    db.pragma('foreign_keys = ON');
  } catch (error) {
    try {
      db.close();
    } catch {
      // Best effort
    }
    throw error;
  }

  try {
    // fullfsync is only supported on macOS
    db.pragma('fullfsync = false');

    // a lower-impact approach, if fullfsync is too impactful
    db.pragma('checkpoint_fullfsync = true');
  } catch (error) {
    logger.warn(
      'openAndSetUpSQLCipher: Unable to set fullfsync',
      Errors.toLogFormat(error)
    );
  }

  db.initTokenizer();

  return db;
}

let logger = sqlLogger;
let databaseFilePath: string | undefined;
let indexedDBPath: string | undefined;

setSqliteLogger((code, message) => {
  if (code === 'SQLITE_SCHEMA') {
    // Ignore query recompilation due to schema changes
    return;
  }
  if (code === 'SQLITE_NOTICE') {
    logger.info(`sqlite(${code}): ${message}`);
    return;
  }
  logger.warn(`sqlite(${code}): ${message}`);
});

export function initialize({
  configDir,
  key,
  isPrimary,
}: {
  appVersion: string;
  configDir: string;
  key: string;
  isPrimary: boolean;
}): WritableDB {
  if (!isString(configDir)) {
    throw new Error('initialize: configDir is required!');
  }
  if (!isString(key)) {
    throw new Error('initialize: key is required!');
  }

  indexedDBPath = join(configDir, 'IndexedDB');

  const dbDir = join(configDir, 'sql');
  mkdirSync(dbDir, { recursive: true });

  databaseFilePath = join(dbDir, 'db.sqlite');

  let db: WritableDB | undefined;

  try {
    db = openAndSetUpSQLCipher(databaseFilePath, {
      key,
    });

    // For profiling use:
    // db.pragma('cipher_profile=\'sqlcipher.log\'');

    // Only the first worker gets to upgrade the schema. The rest just folow.
    if (isPrimary) {
      updateSchema(db, logger);
    }

    // test database
    getMessageCount(db);

    return db;
  } catch (error) {
    logger.error('Database startup error:', error.stack);
    db?.close();
    throw error;
  }
}

export function setupTests(db: WritableDB): void {
  const silentLogger = {
    ...consoleLogger,
    info: noop,
  };
  logger = silentLogger;

  updateSchema(db, logger);
}

function closeReadable(db: ReadableDB): void {
  db.close();
}

function closeWritable(db: WritableDB): void {
  // SQLLite documentation suggests that we run `PRAGMA optimize` right
  // before closing the database connection.
  db.pragma('optimize');

  db.close();
}

export function removeDB(): void {
  if (!databaseFilePath) {
    throw new Error(
      'removeDB: Cannot erase database without a databaseFilePath!'
    );
  }

  logger.warn('removeDB: Removing all database files');
  rmSync(databaseFilePath, { recursive: true, force: true });
  rmSync(`${databaseFilePath}-shm`, { recursive: true, force: true });
  rmSync(`${databaseFilePath}-wal`, { recursive: true, force: true });
}

function removeIndexedDBFiles(_db: WritableDB): void {
  if (!indexedDBPath) {
    throw new Error(
      'removeIndexedDBFiles: Need to initialize and set indexedDBPath first!'
    );
  }

  const pattern = join(indexedDBPath, '*.leveldb');
  rmSync(pattern, { recursive: true, force: true });
  indexedDBPath = undefined;
}

// This is okay to use for queries that:
//
// - Don't modify persistent tables, but create and do work in temporary
//   tables
// - Integrity checks
//
function toUnsafeWritableDB(
  db: ReadableDB,
  _reason: 'only temp table use' | 'integrity check'
): WritableDB {
  return db as unknown as WritableDB;
}

const IDENTITY_KEYS_TABLE = 'identityKeys';
function createOrUpdateIdentityKey(
  db: WritableDB,
  data: StoredIdentityKeyType
): void {
  return createOrUpdate(db, IDENTITY_KEYS_TABLE, data);
}
function getIdentityKeyById(
  db: ReadableDB,
  id: IdentityKeyIdType
): StoredIdentityKeyType | undefined {
  return getById(db, IDENTITY_KEYS_TABLE, id);
}
function bulkAddIdentityKeys(
  db: WritableDB,
  array: Array<StoredIdentityKeyType>
): void {
  return bulkAdd(db, IDENTITY_KEYS_TABLE, array);
}
function removeIdentityKeyById(db: WritableDB, id: IdentityKeyIdType): number {
  return removeById(db, IDENTITY_KEYS_TABLE, id);
}
function removeAllIdentityKeys(db: WritableDB): number {
  return removeAllFromTable(db, IDENTITY_KEYS_TABLE);
}
function getAllIdentityKeys(db: ReadableDB): Array<StoredIdentityKeyType> {
  return getAllFromTable(db, IDENTITY_KEYS_TABLE);
}

const KYBER_PRE_KEYS_TABLE = 'kyberPreKeys';
function createOrUpdateKyberPreKey(
  db: WritableDB,
  data: StoredKyberPreKeyType
): void {
  return createOrUpdate(db, KYBER_PRE_KEYS_TABLE, data);
}
function getKyberPreKeyById(
  db: ReadableDB,
  id: PreKeyIdType
): StoredKyberPreKeyType | undefined {
  return getById(db, KYBER_PRE_KEYS_TABLE, id);
}
function bulkAddKyberPreKeys(
  db: WritableDB,
  array: Array<StoredKyberPreKeyType>
): void {
  return bulkAdd(db, KYBER_PRE_KEYS_TABLE, array);
}
function removeKyberPreKeyById(
  db: WritableDB,
  id: PreKeyIdType | Array<PreKeyIdType>
): number {
  return removeById(db, KYBER_PRE_KEYS_TABLE, id);
}
function removeKyberPreKeysByServiceId(
  db: WritableDB,
  serviceId: ServiceIdString
): void {
  db.prepare('DELETE FROM kyberPreKeys WHERE ourServiceId IS $serviceId;').run({
    serviceId,
  });
}
function markKyberTripleSeenOrFail(
  db: WritableDB,
  { id, signedPreKeyId, baseKey }: KyberPreKeyTripleType
): void {
  // Notes that `kyberPreKey_triples` has
  // - Unique constraint on id, signedPreKeyId, baseKey so that we can't insert
  //   two identical rows
  // - `ON DELETE CASCADE` trigger linked to `kyberPreKeys` table so that we
  //   cleanup the triples whenever we remove the key
  const [query, parameters] = sql`
    INSERT OR FAIL INTO kyberPreKey_triples
      (id, signedPreKeyId, baseKey)
    VALUES
      (${id}, ${signedPreKeyId}, ${baseKey});
  `;

  try {
    db.prepare(query).run(parameters);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error(`Duplicate kyber triple ${id}:${signedPreKeyId}`);
    }

    // Unexpected error
    throw error;
  }
}
function removeAllKyberPreKeys(db: WritableDB): number {
  return removeAllFromTable(db, KYBER_PRE_KEYS_TABLE);
}
function getAllKyberPreKeys(db: ReadableDB): Array<StoredKyberPreKeyType> {
  return getAllFromTable(db, KYBER_PRE_KEYS_TABLE);
}

const PRE_KEYS_TABLE = 'preKeys';
function createOrUpdatePreKey(db: WritableDB, data: StoredPreKeyType): void {
  return createOrUpdate(db, PRE_KEYS_TABLE, data);
}
function getPreKeyById(
  db: ReadableDB,
  id: PreKeyIdType
): StoredPreKeyType | undefined {
  return getById(db, PRE_KEYS_TABLE, id);
}
function bulkAddPreKeys(db: WritableDB, array: Array<StoredPreKeyType>): void {
  return bulkAdd(db, PRE_KEYS_TABLE, array);
}
function removePreKeyById(
  db: WritableDB,
  id: PreKeyIdType | Array<PreKeyIdType>
): number {
  return removeById(db, PRE_KEYS_TABLE, id);
}
function removePreKeysByServiceId(
  db: WritableDB,
  serviceId: ServiceIdString
): void {
  db.prepare('DELETE FROM preKeys WHERE ourServiceId IS $serviceId;').run({
    serviceId,
  });
}
function removeAllPreKeys(db: WritableDB): number {
  return removeAllFromTable(db, PRE_KEYS_TABLE);
}
function getAllPreKeys(db: ReadableDB): Array<StoredPreKeyType> {
  return getAllFromTable(db, PRE_KEYS_TABLE);
}

const SIGNED_PRE_KEYS_TABLE = 'signedPreKeys';
function createOrUpdateSignedPreKey(
  db: WritableDB,
  data: StoredSignedPreKeyType
): void {
  return createOrUpdate(db, SIGNED_PRE_KEYS_TABLE, data);
}
function getSignedPreKeyById(
  db: ReadableDB,
  id: SignedPreKeyIdType
): StoredSignedPreKeyType | undefined {
  return getById(db, SIGNED_PRE_KEYS_TABLE, id);
}
function bulkAddSignedPreKeys(
  db: WritableDB,
  array: Array<StoredSignedPreKeyType>
): void {
  return bulkAdd(db, SIGNED_PRE_KEYS_TABLE, array);
}
function removeSignedPreKeyById(
  db: WritableDB,
  id: SignedPreKeyIdType | Array<SignedPreKeyIdType>
): number {
  return removeById(db, SIGNED_PRE_KEYS_TABLE, id);
}
function removeSignedPreKeysByServiceId(
  db: WritableDB,
  serviceId: ServiceIdString
): void {
  db.prepare('DELETE FROM signedPreKeys WHERE ourServiceId IS $serviceId;').run(
    {
      serviceId,
    }
  );
}
function removeAllSignedPreKeys(db: WritableDB): number {
  return removeAllFromTable(db, SIGNED_PRE_KEYS_TABLE);
}
function getAllSignedPreKeys(db: ReadableDB): Array<StoredSignedPreKeyType> {
  const rows: JSONRows = db
    .prepare(
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
function createOrUpdateItem<K extends ItemKeyType>(
  db: WritableDB,
  data: StoredItemType<K>
): void {
  return createOrUpdate(db, ITEMS_TABLE, data);
}
function getItemById<K extends ItemKeyType>(
  db: ReadableDB,
  id: K
): StoredItemType<K> | undefined {
  return getById(db, ITEMS_TABLE, id);
}
function getAllItems(db: ReadableDB): StoredAllItemsType {
  const rows: JSONRows = db
    .prepare('SELECT json FROM items ORDER BY id ASC;')
    .all();

  type RawItemType = { id: ItemKeyType; value: unknown };

  const items = rows.map(row => jsonToObject<RawItemType>(row.json));

  const result: Record<ItemKeyType, unknown> = Object.create(null);

  for (const { id, value } of items) {
    result[id] = value;
  }

  return result as unknown as StoredAllItemsType;
}
function removeItemById(
  db: WritableDB,
  id: ItemKeyType | Array<ItemKeyType>
): number {
  return removeById(db, ITEMS_TABLE, id);
}
function removeAllItems(db: WritableDB): number {
  return removeAllFromTable(db, ITEMS_TABLE);
}

function createOrUpdateSenderKey(db: WritableDB, key: SenderKeyType): void {
  db.prepare(
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
function getSenderKeyById(
  db: ReadableDB,
  id: SenderKeyIdType
): SenderKeyType | undefined {
  return db
    .prepare('SELECT * FROM senderKeys WHERE id = $id')
    .get<SenderKeyType>({
      id,
    });
}
function removeAllSenderKeys(db: WritableDB): void {
  db.prepare('DELETE FROM senderKeys').run();
}
function getAllSenderKeys(db: ReadableDB): Array<SenderKeyType> {
  return db.prepare('SELECT * FROM senderKeys').all<SenderKeyType>();
}
function removeSenderKeyById(db: WritableDB, id: SenderKeyIdType): void {
  db.prepare('DELETE FROM senderKeys WHERE id = $id').run({ id });
}

function insertSentProto(
  db: WritableDB,
  proto: SentProtoType,
  options: {
    recipients: SentRecipientsType;
    messageIds: SentMessagesType;
  }
): number {
  const { recipients, messageIds } = options;

  // Note: we use `pluck` in this function to fetch only the first column of returned row.

  return db.transaction(() => {
    // 1. Insert the payload, fetching its primary key id
    const info = db
      .prepare(
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
      )
      .run({
        ...proto,
        urgent: proto.urgent ? 1 : 0,
        hasPniSignatureMessage: proto.hasPniSignatureMessage ? 1 : 0,
      });
    const id = parseIntOrThrow(
      info.lastInsertRowid,
      'insertSentProto/lastInsertRowid'
    );

    // 2. Insert a record for each recipient device.
    const recipientStatement = db.prepare(
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
    const messageStatement = db.prepare(
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

function deleteSentProtosOlderThan(db: WritableDB, timestamp: number): void {
  db.prepare(
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

function deleteSentProtoByMessageId(db: WritableDB, messageId: string): void {
  db.prepare(
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

function insertProtoRecipients(
  db: WritableDB,
  {
    id,
    recipientServiceId,
    deviceIds,
  }: {
    id: number;
    recipientServiceId: ServiceIdString;
    deviceIds: Array<number>;
  }
): void {
  db.transaction(() => {
    const statement = db.prepare(
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

function deleteSentProtoRecipient(
  db: WritableDB,
  options:
    | DeleteSentProtoRecipientOptionsType
    | ReadonlyArray<DeleteSentProtoRecipientOptionsType>
): DeleteSentProtoRecipientResultType {
  const items = Array.isArray(options) ? options : [options];

  // Note: we use `pluck` in this function to fetch only the first column of
  // returned row.

  return db.transaction(() => {
    const successfulPhoneNumberShares = new Array<ServiceIdString>();

    for (const item of items) {
      const { timestamp, recipientServiceId, deviceId } = item;

      // 1. Figure out what payload we're talking about.
      const rows = db
        .prepare(
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
        )
        .all({ timestamp, recipientServiceId, deviceId });
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
      db.prepare(
        `
        DELETE FROM sendLogRecipients
        WHERE
          payloadId = $id AND
          recipientServiceId = $recipientServiceId AND
          deviceId = $deviceId;
        `
      ).run({ id, recipientServiceId, deviceId });

      // 3. See how many more recipient devices there were for this payload.
      const remainingDevices =
        db
          .prepare(
            `
        SELECT count(1) FROM sendLogRecipients
        WHERE payloadId = $id AND recipientServiceId = $recipientServiceId;
        `,
            { pluck: true }
          )
          .get<number>({ id, recipientServiceId }) ?? 0;

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
      const remainingTotal = db
        .prepare(
          'SELECT count(1) FROM sendLogRecipients WHERE payloadId = $id;',
          { pluck: true }
        )
        .get({ id });

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

      db.prepare('DELETE FROM sendLogPayloads WHERE id = $id;').run({
        id,
      });
    }

    return { successfulPhoneNumberShares };
  })();
}

function getSentProtoByRecipient(
  db: WritableDB,
  {
    now,
    recipientServiceId,
    timestamp,
  }: {
    now: number;
    recipientServiceId: ServiceIdString;
    timestamp: number;
  }
): SentProtoWithMessageIdsType | undefined {
  const HOUR = 1000 * 60 * 60;
  const oneDayAgo = now - HOUR * 24;

  deleteSentProtosOlderThan(db, oneDayAgo);

  const row = db
    .prepare(
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
    )
    .get<
      SentProtoDBType & {
        messageIds: string;
      }
    >({
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
function removeAllSentProtos(db: WritableDB): void {
  db.prepare('DELETE FROM sendLogPayloads;').run();
}
function getAllSentProtos(db: ReadableDB): Array<SentProtoType> {
  const rows = db
    .prepare('SELECT * FROM sendLogPayloads;')
    .all<SentProtoDBType>();

  return rows.map(row => ({
    ...row,
    urgent: isNumber(row.urgent) ? Boolean(row.urgent) : true,
    hasPniSignatureMessage: isNumber(row.hasPniSignatureMessage)
      ? Boolean(row.hasPniSignatureMessage)
      : true,
  }));
}
function _getAllSentProtoRecipients(
  db: ReadableDB
): Array<SentRecipientsDBType> {
  return db
    .prepare('SELECT * FROM sendLogRecipients;')
    .all<SentRecipientsDBType>();
}
function _getAllSentProtoMessageIds(db: ReadableDB): Array<SentMessageDBType> {
  return db
    .prepare('SELECT * FROM sendLogMessageIds;')
    .all<SentMessageDBType>();
}

const SESSIONS_TABLE = 'sessions';
function createOrUpdateSession(db: WritableDB, data: SessionType): void {
  const { id, conversationId, ourServiceId, serviceId, deviceId, record } =
    data;
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

  db.prepare(
    `
    INSERT OR REPLACE INTO sessions (
      id,
      conversationId,
      ourServiceId,
      serviceId,
      deviceId,
      record
    ) values (
      $id,
      $conversationId,
      $ourServiceId,
      $serviceId,
      $deviceId,
      $record
    )
    `
  ).run({
    id,
    conversationId,
    ourServiceId,
    serviceId,
    deviceId,
    record,
  });
}

function createOrUpdateSessions(
  db: WritableDB,
  array: Array<SessionType>
): void {
  db.transaction(() => {
    for (const item of array) {
      createOrUpdateSession(db, item);
    }
  })();
}

function commitDecryptResult(
  db: WritableDB,
  {
    kyberPreKeysToRemove,
    preKeysToRemove,
    senderKeys,
    sessions,
    unprocessed,
    kyberTriples,
  }: {
    kyberPreKeysToRemove: Array<PreKeyIdType>;
    preKeysToRemove: Array<PreKeyIdType>;
    senderKeys: Array<SenderKeyType>;
    sessions: Array<SessionType>;
    unprocessed: Array<UnprocessedType>;
    kyberTriples: Array<KyberPreKeyTripleType>;
  }
): void {
  db.transaction(() => {
    if (kyberPreKeysToRemove.length > 0) {
      const kyberPreKeyChanges = removeKyberPreKeyById(
        db,
        kyberPreKeysToRemove
      );
      if (kyberPreKeyChanges === kyberPreKeysToRemove.length) {
        logger.info(
          `commitDecryptResult: Removed ${kyberPreKeyChanges} kyberPreKeys`
        );
      } else {
        logger.error(
          `commitDecryptResult: Changed ${kyberPreKeyChanges} keys, but had ${kyberPreKeysToRemove.length} kyberPreKeys to remove`
        );
      }
    }
    if (preKeysToRemove.length > 0) {
      const preKeyChanges = removePreKeyById(db, preKeysToRemove);
      if (preKeyChanges === preKeysToRemove.length) {
        logger.info(`commitDecryptResult: Removed ${preKeyChanges} preKeys`);
      } else {
        logger.error(
          `commitDecryptResult: Changed ${preKeyChanges} keys, but had ${preKeysToRemove.length} preKeys to remove`
        );
      }
    }

    for (const item of senderKeys) {
      createOrUpdateSenderKey(db, item);
    }

    for (const item of sessions) {
      createOrUpdateSession(db, item);
    }

    for (const item of unprocessed) {
      saveUnprocessed(db, item);
    }

    for (const item of kyberTriples) {
      markKyberTripleSeenOrFail(db, item);
    }
  })();
}

function removeSessionById(db: WritableDB, id: SessionIdType): number {
  return removeById(db, SESSIONS_TABLE, id);
}
function removeSessionsByConversation(
  db: WritableDB,
  conversationId: string
): void {
  db.prepare(
    `
    DELETE FROM sessions
    WHERE conversationId = $conversationId;
    `
  ).run({
    conversationId,
  });
}
function removeSessionsByServiceId(
  db: WritableDB,
  serviceId: ServiceIdString
): void {
  db.prepare(
    `
    DELETE FROM sessions
    WHERE serviceId = $serviceId;
    `
  ).run({
    serviceId,
  });
}
function removeAllSessions(db: WritableDB): number {
  return removeAllFromTable(db, SESSIONS_TABLE);
}
function getAllSessions(db: ReadableDB): Array<SessionType> {
  return db.prepare('SELECT * FROM sessions').all();
}
function getAllKyberTriples(db: ReadableDB): Array<KyberPreKeyTripleType> {
  return db.prepare('SELECT * FROM kyberPreKey_triples').all();
}
// Conversations

function getConversationCount(db: ReadableDB): number {
  return getCountFromTable(db, 'conversations');
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

function saveConversation(db: WritableDB, data: ConversationType): void {
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
    expireTimerVersion,
  } = data;

  const membersList = getConversationMembersList(data);

  db.prepare(
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
      profileLastFetchedAt,
      expireTimerVersion
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
      $profileLastFetchedAt,
      $expireTimerVersion
    );
    `
  ).run({
    id,
    json: objectToJSON(
      omit(data, ['profileLastFetchedAt', 'expireTimerVersion'])
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
    expireTimerVersion,
  });
}

function saveConversations(
  db: WritableDB,
  arrayOfConversations: Array<ConversationType>
): void {
  db.transaction(() => {
    for (const conversation of arrayOfConversations) {
      saveConversation(db, conversation);
    }
  })();
}

function updateConversation(db: WritableDB, data: ConversationType): void {
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
    expireTimerVersion,
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
      profileLastFetchedAt = $profileLastFetchedAt,
      expireTimerVersion = $expireTimerVersion
    WHERE id = $id;
    `
  ).run({
    id,
    json: objectToJSON(omit(data, ['profileLastFetchedAt'])),

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
    expireTimerVersion,
  });
}

function updateConversations(
  db: WritableDB,
  array: Array<ConversationType>
): void {
  db.transaction(() => {
    for (const item of array) {
      updateConversation(db, item);
    }
  })();
}

function removeConversations(
  db: WritableDB,
  ids: ReadonlyArray<string>,
  persistent: boolean
): void {
  // Our node interface doesn't seem to allow you to replace one single ? with an array
  db.prepare(
    `
    DELETE FROM conversations
    WHERE id IN ( ${ids.map(() => '?').join(', ')} );
    `,
    { persistent }
  ).run(ids);
}

function removeConversation(db: WritableDB, id: Array<string> | string): void {
  if (!Array.isArray(id)) {
    db.prepare('DELETE FROM conversations WHERE id = $id;').run({
      id,
    });

    return;
  }

  if (!id.length) {
    throw new Error('removeConversation: No ids to delete!');
  }

  batchMultiVarQuery(db, id, (ids, persistent) =>
    removeConversations(db, ids, persistent)
  );
}

function _removeAllConversations(db: WritableDB): void {
  db.prepare('DELETE from conversations;').run();
}

function getConversationById(
  db: ReadableDB,
  id: string
): ConversationType | undefined {
  const row = db
    .prepare(
      `
      SELECT json, profileLastFetchedAt, expireTimerVersion
      FROM conversations
      WHERE id = $id
      `
    )
    .get<ConversationRow>({ id });

  if (!row) {
    return undefined;
  }

  return rowToConversation(row);
}

function getAllConversations(db: ReadableDB): Array<ConversationType> {
  const rows: ConversationRows = db
    .prepare(
      `
      SELECT json, profileLastFetchedAt, expireTimerVersion
      FROM conversations
      ORDER BY id ASC;
      `
    )
    .all();

  return rows.map(row => rowToConversation(row));
}

function getAllConversationIds(db: ReadableDB): Array<string> {
  const rows: Array<{ id: string }> = db
    .prepare(
      `
      SELECT id FROM conversations ORDER BY id ASC;
      `
    )
    .all();

  return rows.map(row => row.id);
}

function searchMessages(
  db: ReadableDB,
  {
    query,
    options,
    conversationId,
    contactServiceIdsMatchingQuery,
  }: {
    query: string;
    options?: { limit?: number };
    conversationId?: string;
    contactServiceIdsMatchingQuery?: Array<ServiceIdString>;
  }
): Array<ServerSearchResultMessageType> {
  const { limit = conversationId ? 100 : 500 } = options ?? {};

  const writable = toUnsafeWritableDB(db, 'only temp table use');

  const normalizedQuery = writable
    .signalTokenize(query)
    .map(token => `"${token.replace(/"/g, '""')}"*`)
    .join(' ');

  // FTS5 is not happy about empty "MATCH" so short-circuit early.
  if (!normalizedQuery) {
    return [];
  }

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
  return writable.transaction(() => {
    writable.exec(
      `
      CREATE TEMP TABLE tmp_results(rowid INTEGER PRIMARY KEY ASC);
      CREATE TEMP TABLE tmp_filtered_results(rowid INTEGER PRIMARY KEY ASC);
      `
    );

    writable
      .prepare(
        `
        INSERT INTO tmp_results (rowid)
        SELECT
          rowid
        FROM
          messages_fts
        WHERE
          messages_fts.body MATCH $query;
      `
      )
      .run({ query: normalizedQuery });

    if (conversationId === undefined) {
      writable
        .prepare(
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
        )
        .run({ limit });
    } else {
      writable
        .prepare(
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
        )
        .run({ conversationId, limit });
    }

    const prefixedColumns = sqlJoin(
      MESSAGE_COLUMNS_FRAGMENTS.map(name => sqlFragment`messages.${name}`)
    );

    // The `MATCH` is necessary in order to for `snippet()` helper function to
    // give us the right results. We can't call `snippet()` in the query above
    // because it would bloat the temporary table with text data and we want
    // to keep its size minimal for `ORDER BY` + `LIMIT` to be fast.
    const ftsFragment = sqlFragment`
      SELECT
        messages.rowid,
        ${prefixedColumns},
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

    let queryResult: Array<
      ServerMessageSearchResultType & MessageTypeUnhydrated
    >;

    if (!contactServiceIdsMatchingQuery?.length) {
      const [sqlQuery, params] = sql`${ftsFragment};`;
      queryResult = writable.prepare(sqlQuery).all(params);
    } else {
      const coalescedColumns = MESSAGE_COLUMNS_FRAGMENTS.map(
        name => sqlFragment`
          COALESCE(messages.${name}, ftsResults.${name}) AS ${name}
        `
      );

      // If contactServiceIdsMatchingQuery is not empty, we due an OUTER JOIN
      // between:
      // 1) the messages that mention at least one of
      //    contactServiceIdsMatchingQuery, and
      // 2) the messages that match all the search terms via FTS
      //
      // Note: this groups the results by rowid, so even if one message
      // mentions multiple matching UUIDs, we only return one to be
      // highlighted
      const [sqlQuery, params] = sql`
        SELECT
          messages.rowid as rowid,
          ${sqlJoin(coalescedColumns)},
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
      queryResult = writable.prepare(sqlQuery).all(params);
    }

    writable.exec(
      `
      DROP TABLE tmp_results;
      DROP TABLE tmp_filtered_results;
      `
    );
    const hydrated = hydrateMessages(db, queryResult);
    return queryResult.map((row, idx) => {
      return {
        ...hydrated[idx],
        ftsSnippet: row.ftsSnippet,
        mentionAci: row.mentionAci,
        mentionStart: row.mentionStart,
        mentionLength: row.mentionLength,
      };
    });
  })();
}

function getStoryCount(db: ReadableDB, conversationId: string): number {
  return (
    db
      .prepare(
        `
    SELECT count(1)
    FROM messages
    WHERE conversationId = $conversationId AND isStory = 1;
    `,
        {
          pluck: true,
        }
      )
      .get<number>({ conversationId }) ?? 0
  );
}

function getMessageCount(db: ReadableDB, conversationId?: string): number {
  if (conversationId === undefined) {
    return getCountFromTable(db, 'messages');
  }

  const count = db
    .prepare(
      `
    SELECT count(1)
    FROM messages
    WHERE conversationId = $conversationId;
    `,
      {
        pluck: true,
      }
    )
    .get<number>({ conversationId });

  return count ?? 0;
}

// Note: we really only use this in 1:1 conversations, where story replies are always
//   shown, so this has no need to be story-aware.
function hasUserInitiatedMessages(
  db: ReadableDB,
  conversationId: string
): boolean {
  const exists = db
    .prepare(
      `
  SELECT EXISTS(
    SELECT 1 FROM messages
    INDEXED BY message_user_initiated
    WHERE
      conversationId IS $conversationId AND
      isUserInitiatedMessage IS 1
  );
  `,
      {
        pluck: true,
      }
    )
    .get<number>({ conversationId });

  return exists !== 0;
}

export function getMostRecentAddressableMessages(
  db: ReadableDB,
  conversationId: string,
  limit = 5
): Array<MessageType> {
  return db.transaction(() => {
    const [query, parameters] = sql`
    SELECT
      ${sqlJoin(MESSAGE_COLUMNS_FRAGMENTS)}
    FROM messages
    INDEXED BY messages_by_date_addressable
    WHERE
      conversationId IS ${conversationId} AND
      isAddressableMessage = 1
    ORDER BY received_at DESC, sent_at DESC
    LIMIT ${limit};
  `;

    const rows = db.prepare(query).all<MessageTypeUnhydrated>(parameters);

    return hydrateMessages(db, rows);
  })();
}

export function getMostRecentAddressableNondisappearingMessages(
  db: ReadableDB,
  conversationId: string,
  limit = 5
): Array<MessageType> {
  return db.transaction(() => {
    const [query, parameters] = sql`
    SELECT
      ${sqlJoin(MESSAGE_COLUMNS_FRAGMENTS)}
    FROM messages
    INDEXED BY messages_by_date_addressable_nondisappearing
    WHERE
      expireTimer IS NULL AND
      conversationId IS ${conversationId} AND
      isAddressableMessage = 1
    ORDER BY received_at DESC, sent_at DESC
    LIMIT ${limit};
  `;

    const rows = db.prepare(query).all<MessageTypeUnhydrated>(parameters);

    return hydrateMessages(db, rows);
  })();
}

export function removeSyncTaskById(db: WritableDB, id: string): void {
  const [query, parameters] = sql`
    DELETE FROM syncTasks
    WHERE id IS ${id}
  `;

  db.prepare(query).run(parameters);
}
function removeSyncTaskBatch(
  db: WritableDB,
  ids: ReadonlyArray<string>,
  persistent: boolean
): void {
  db.prepare(
    `
    DELETE FROM syncTasks
    WHERE id IN ( ${ids.map(() => '?').join(', ')} );
    `,
    { persistent }
  ).run(ids);
}

function removeSyncTasks(db: WritableDB, ids: ReadonlyArray<string>): void {
  batchMultiVarQuery(db, ids, (batch, persistent) =>
    removeSyncTaskBatch(db, batch, persistent)
  );
}

export function saveSyncTasks(
  db: WritableDB,
  tasks: Array<SyncTaskType>
): void {
  return db.transaction(() => {
    tasks.forEach(task => saveSyncTask(db, task));
  })();
}
function saveSyncTask(db: WritableDB, task: SyncTaskType): void {
  const { id, attempts, createdAt, data, envelopeId, sentAt, type } = task;

  const [query, parameters] = sql`
    INSERT INTO syncTasks (
      id,
      attempts,
      createdAt,
      data,
      envelopeId,
      sentAt,
      type
    ) VALUES (
      ${id},
      ${attempts},
      ${createdAt},
      ${objectToJSON(data)},
      ${envelopeId},
      ${sentAt},
      ${type}
    )
  `;

  db.prepare(query).run(parameters);
}

export function incrementAllSyncTaskAttempts(db: WritableDB): void {
  const [updateQuery, updateParams] = sql`
    UPDATE syncTasks
    SET attempts = attempts + 1
  `;
  return db.transaction(() => {
    db.prepare(updateQuery).run(updateParams);
  })();
}

export function dequeueOldestSyncTasks(
  db: WritableDB,
  options: {
    previousRowId: number | null;
    incrementAttempts?: boolean;
    syncTaskTypes?: Array<SyncTaskType['type']>;
  }
): { tasks: Array<SyncTaskType>; lastRowId: number | null } {
  const { previousRowId, incrementAttempts = true, syncTaskTypes } = options;
  return db.transaction(() => {
    const orderBy = sqlFragment`ORDER BY rowid ASC`;
    const limit = sqlFragment`LIMIT 10000`;
    let predicate = sqlFragment`rowid > ${previousRowId ?? 0}`;
    if (syncTaskTypes && syncTaskTypes.length > 0) {
      predicate = sqlFragment`${predicate} AND type IN (${sqlJoin(syncTaskTypes)})`;
    }

    const [deleteOldQuery, deleteOldParams] = sql`
      DELETE FROM syncTasks
      WHERE
        attempts >= ${MAX_SYNC_TASK_ATTEMPTS} AND
        createdAt < ${Date.now() - durations.DAY * 2}
    `;

    const result = db.prepare(deleteOldQuery).run(deleteOldParams);

    if (result.changes > 0) {
      logger.info(
        `dequeueOldestSyncTasks: Deleted ${result.changes} expired sync tasks`
      );
    }

    const [selectAllQuery, selectAllParams] = sql`
      SELECT rowid, * FROM syncTasks
      WHERE ${predicate}
      ${orderBy}
      ${limit}
    `;

    const rows = db.prepare(selectAllQuery).all<
      {
        rowid: number;
        data: string;
      } & SyncTaskType
    >(selectAllParams);
    if (!rows.length) {
      return { tasks: [], lastRowId: null };
    }

    const firstRowId = rows.at(0)?.rowid;
    const lastRowId = rows.at(-1)?.rowid;

    strictAssert(firstRowId, 'dequeueOldestSyncTasks: firstRowId is null');
    strictAssert(lastRowId, 'dequeueOldestSyncTasks: lastRowId is null');

    let tasks: Array<SyncTaskType> = rows.map(row => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { rowid: _rowid, ...rest } = row;
      return {
        ...rest,
        data: jsonToObject(row.data),
      };
    });

    if (incrementAttempts) {
      let updatePredicate = sqlFragment`rowid >= ${firstRowId} AND rowid <= ${lastRowId}`;
      if (syncTaskTypes && syncTaskTypes.length > 0) {
        updatePredicate = sqlFragment`${updatePredicate} AND type IN (${sqlJoin(syncTaskTypes)})`;
      }
      const [updateQuery, updateParams] = sql`
        UPDATE syncTasks
        SET attempts = attempts + 1
        WHERE ${updatePredicate}
        RETURNING id, attempts;
      `;

      const res = db.prepare(updateQuery).all<{
        id: string;
        attempts: number;
      }>(updateParams);

      if (Array.isArray(res)) {
        const idToAttempts = new Map<string, number>(
          res.map(({ id, attempts }) => [id, attempts])
        );
        tasks = tasks.map(task => {
          const { id } = task;
          const attempts = idToAttempts.get(id) ?? task.attempts;
          return { ...task, attempts };
        });
      } else {
        logger.error(
          'dequeueOldestSyncTasks: failed to get sync task attempts'
        );
      }
    }

    return { tasks, lastRowId };
  })();
}

function saveMessageAttachmentsForRootOrEditedVersion(
  db: WritableDB,
  message: {
    id: string;
    conversationId: string;
    sent_at: number;
  } & Pick<
    MessageType,
    | 'attachments'
    | 'bodyAttachment'
    | 'contact'
    | 'preview'
    | 'quote'
    | 'type'
    | 'sticker'
    | 'isViewOnce'
    | 'received_at'
    | 'received_at_ms'
  >,
  { editHistoryIndex }: { editHistoryIndex: number | null }
) {
  const {
    id: messageId,
    type: messageType,
    conversationId,
    sent_at: sentAt,
    received_at: receivedAt,
    received_at_ms: receivedAtMs,
    isViewOnce,
  } = message;

  const mainAttachments = message.attachments;
  if (mainAttachments) {
    for (let i = 0; i < mainAttachments.length; i += 1) {
      const attachment = mainAttachments[i];
      saveMessageAttachment({
        db,
        messageId,
        messageType,
        conversationId,
        sentAt,
        receivedAt,
        receivedAtMs,
        attachmentType: 'attachment',
        attachment,
        orderInMessage: i,
        editHistoryIndex,
        isViewOnce,
      });
    }
  }

  const { bodyAttachment } = message;
  if (bodyAttachment) {
    saveMessageAttachment({
      db,
      messageId,
      messageType,
      conversationId,
      sentAt,
      receivedAt,
      receivedAtMs,
      attachmentType: 'long-message',
      attachment: bodyAttachment,
      orderInMessage: 0,
      editHistoryIndex,
      isViewOnce,
    });
  }

  const previewAttachments = message.preview?.map(preview => preview.image);
  if (previewAttachments) {
    for (let i = 0; i < previewAttachments.length; i += 1) {
      const attachment = previewAttachments[i];
      if (!attachment) {
        continue;
      }
      saveMessageAttachment({
        db,
        messageId,
        messageType,
        conversationId,
        sentAt,
        receivedAt,
        receivedAtMs,
        attachmentType: 'preview',
        attachment,
        orderInMessage: i,
        editHistoryIndex,
        isViewOnce,
      });
    }
  }

  const quoteAttachments = message.quote?.attachments;
  if (quoteAttachments) {
    for (let i = 0; i < quoteAttachments.length; i += 1) {
      const attachment = quoteAttachments[i];
      if (!attachment?.thumbnail) {
        continue;
      }
      saveMessageAttachment({
        db,
        messageId,
        messageType,
        conversationId,
        sentAt,
        receivedAt,
        receivedAtMs,
        attachmentType: 'quote',
        attachment: attachment.thumbnail,
        orderInMessage: i,
        editHistoryIndex,
        isViewOnce,
      });
    }
  }

  const contactAttachments = message.contact?.map(
    contact => contact.avatar?.avatar
  );
  if (contactAttachments) {
    for (let i = 0; i < contactAttachments.length; i += 1) {
      const attachment = contactAttachments[i];
      if (!attachment) {
        continue;
      }
      saveMessageAttachment({
        db,
        messageId,
        messageType,
        conversationId,
        sentAt,
        receivedAt,
        receivedAtMs,
        attachmentType: 'contact',
        attachment,
        orderInMessage: i,
        editHistoryIndex,
        isViewOnce,
      });
    }
  }

  const stickerAttachment = message.sticker?.data;
  if (stickerAttachment) {
    saveMessageAttachment({
      db,
      messageId,
      messageType,
      conversationId,
      sentAt,
      receivedAt,
      receivedAtMs,
      attachmentType: 'sticker',
      attachment: stickerAttachment,
      orderInMessage: 0,
      editHistoryIndex,
      isViewOnce,
    });
  }
}
function saveMessageAttachments(
  db: WritableDB,
  message: ReadonlyDeep<MessageType>
) {
  const messageId = message.id;
  const [deleteQuery, deleteParams] = sql`
    DELETE FROM message_attachments
    WHERE messageId = ${messageId};
  `;
  db.prepare(deleteQuery).run(deleteParams);

  saveMessageAttachmentsForRootOrEditedVersion(db, message, {
    editHistoryIndex: null,
  });

  message.editHistory?.forEach((editHistory, idx) => {
    saveMessageAttachmentsForRootOrEditedVersion(
      db,
      {
        id: message.id,
        type: message.type,
        conversationId: message.conversationId,
        sent_at: editHistory.timestamp,
        isViewOnce: message.isViewOnce,
        ...editHistory,
      },
      { editHistoryIndex: idx }
    );
  });
}

function saveMessageAttachment({
  db,
  messageId,
  messageType,
  conversationId,
  sentAt,
  receivedAt,
  receivedAtMs,
  attachmentType,
  attachment,
  orderInMessage,
  editHistoryIndex,
  isViewOnce,
}: {
  db: WritableDB;
  messageId: string;
  messageType: string;
  conversationId: string;
  sentAt: number;
  receivedAt: number;
  receivedAtMs: number | undefined;
  attachmentType: MessageAttachmentType;
  attachment: AttachmentType;
  orderInMessage: number;
  editHistoryIndex: number | null;
  isViewOnce: boolean | undefined;
}) {
  const unparsedValues: ShallowNullToUndefined<MessageAttachmentDBType> = {
    messageId,
    messageType,
    editHistoryIndex:
      editHistoryIndex ?? ROOT_MESSAGE_ATTACHMENT_EDIT_HISTORY_INDEX,
    attachmentType,
    orderInMessage,
    conversationId,
    sentAt,
    receivedAt,
    receivedAtMs,
    clientUuid: attachment.clientUuid,
    size: attachment.size,
    duration: attachment.duration,
    contentType: attachment.contentType,
    path: attachment.path,
    localKey: attachment.localKey,
    plaintextHash: attachment.plaintextHash,
    caption: attachment.caption,
    blurHash: attachment.blurHash,
    height: attachment.height,
    width: attachment.width,
    digest: attachment.digest,
    key: attachment.key,
    fileName: attachment.fileName,
    downloadPath: attachment.downloadPath,
    transitCdnKey: attachment.cdnKey ?? attachment.cdnId,
    transitCdnNumber: attachment.cdnNumber,
    transitCdnUploadTimestamp: attachment.uploadTimestamp,
    backupCdnNumber: attachment.backupCdnNumber,
    incrementalMac: attachment.incrementalMac,
    incrementalMacChunkSize: attachment.chunkSize,
    thumbnailPath: attachment.thumbnail?.path,
    thumbnailSize: attachment.thumbnail?.size,
    thumbnailContentType: attachment.thumbnail?.contentType,
    thumbnailLocalKey: attachment.thumbnail?.localKey,
    thumbnailVersion: attachment.thumbnail?.version,
    screenshotPath: attachment.screenshot?.path,
    screenshotSize: attachment.screenshot?.size,
    screenshotContentType: attachment.screenshot?.contentType,
    screenshotLocalKey: attachment.screenshot?.localKey,
    screenshotVersion: attachment.screenshot?.version,
    backupThumbnailPath: attachment.thumbnailFromBackup?.path,
    backupThumbnailSize: attachment.thumbnailFromBackup?.size,
    backupThumbnailContentType: attachment.thumbnailFromBackup?.contentType,
    backupThumbnailLocalKey: attachment.thumbnailFromBackup?.localKey,
    backupThumbnailVersion: attachment.thumbnailFromBackup?.version,
    storyTextAttachmentJson: attachment.textAttachment
      ? objectToJSON(attachment.textAttachment)
      : undefined,
    localBackupPath: attachment.localBackupPath,
    flags: attachment.flags,
    error: convertOptionalBooleanToInteger(attachment.error),
    wasTooBig: convertOptionalBooleanToInteger(attachment.wasTooBig),
    backfillError: convertOptionalBooleanToInteger(attachment.backfillError),
    isCorrupted: convertOptionalBooleanToInteger(attachment.isCorrupted),
    isViewOnce: convertOptionalBooleanToInteger(isViewOnce),
    copiedFromQuotedAttachment:
      'copied' in attachment
        ? convertOptionalBooleanToInteger(attachment.copied)
        : undefined,
    version: attachment.version,
    pending: convertOptionalBooleanToInteger(attachment.pending),
  };

  try {
    const values: MessageAttachmentDBType =
      shallowConvertUndefinedToNull(unparsedValues);

    db.prepare(
      `
        INSERT OR REPLACE INTO message_attachments
          (${MESSAGE_ATTACHMENT_COLUMNS.join(', ')})
        VALUES
          (${MESSAGE_ATTACHMENT_COLUMNS.map(name => `$${name}`).join(', ')});
      `
    ).run(values);
  } catch (e) {
    // Attachments used to be stored in JSON and may not have the types we expect. If we
    // fail to save one, we parse/transform through a permissive zod schema (i.e. one that
    // will convert invalid values to null when possible)
    logger.error(
      'Failed to save to message_attachments',
      Errors.toLogFormat(e)
    );
    const values: MessageAttachmentDBType = parseLoose(
      permissiveMessageAttachmentSchema,
      unparsedValues
    );

    db.prepare(
      `
        INSERT OR REPLACE INTO message_attachments
          (${MESSAGE_ATTACHMENT_COLUMNS.join(', ')})
        VALUES
          (${MESSAGE_ATTACHMENT_COLUMNS.map(name => `$${name}`).join(', ')});
      `
    ).run(values);

    logger.info('Recovered from invalid message_attachment save');
  }
}

function _testOnlyRemoveMessageAttachments(
  db: WritableDB,
  timestamp: number
): void {
  const [query, params] = sql`
    DELETE FROM message_attachments
      WHERE sentAt = ${timestamp};`;

  db.prepare(query).run(params);
}

function saveMessage(
  db: WritableDB,
  message: ReadonlyDeep<MessageType>,
  options: {
    alreadyInTransaction?: boolean;
    forceSave?: boolean;
    jobToInsert?: StoredJob;
    ourAci: AciString;
    _testOnlyAvoidNormalizingAttachments?: boolean;
  }
): string {
  const { alreadyInTransaction, forceSave, jobToInsert, ourAci } = options;
  if (!alreadyInTransaction) {
    return db.transaction(() => {
      return saveMessage(db, message, {
        ...options,
        alreadyInTransaction: true,
      });
    })();
  }

  const {
    body,
    conversationId,
    id,
    isErased,
    isViewOnce,
    mentionsMe,
    received_at,
    received_at_ms,
    schemaVersion,
    sent_at,
    serverGuid,
    source,
    sourceServiceId,
    sourceDevice,
    storyId,
    timestamp,
    type,
    readStatus,
    expireTimer,
    expirationStartTimestamp,
    seenStatus: originalSeenStatus,
    serverTimestamp,
    unidentifiedDeliveryReceived,

    ...json
  } = message;

  // Extracted separately since we store this field in JSON
  const { attachments, groupV2Change } = message;

  let seenStatus = originalSeenStatus;

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
    logger.warn(
      `saveMessage: Message ${id}/${type} is unread but had seenStatus=${seenStatus}. Forcing to UnseenStatus.Unseen.`
    );

    // eslint-disable-next-line no-param-reassign
    message = {
      ...message,
      seenStatus: SeenStatus.Unseen,
    };
    seenStatus = SeenStatus.Unseen;
  }

  const dataToSaveAsJSON = { ...json };

  const hasRequiredFields = conversationId != null && sent_at != null;
  if (!hasRequiredFields) {
    logger.error(
      'saveMessage: saving message without conversationId or sent_at!',
      { conversationId, sent_at }
    );
  }

  const normalizeAttachmentData =
    hasRequiredFields && options._testOnlyAvoidNormalizingAttachments !== true;

  if (normalizeAttachmentData) {
    // Remove attachments from json data
    delete dataToSaveAsJSON.attachments;
    delete dataToSaveAsJSON.bodyAttachment;
    delete dataToSaveAsJSON.preview;
    delete dataToSaveAsJSON.quote;
    delete dataToSaveAsJSON.contact;
    delete dataToSaveAsJSON.sticker;
    delete dataToSaveAsJSON.editHistory;

    dataToSaveAsJSON.preview = message.preview?.map(preview =>
      omit(preview, 'image')
    );
    dataToSaveAsJSON.quote = message.quote
      ? {
          ...message.quote,
          attachments: message.quote.attachments.map(quoteAttachment =>
            omit(quoteAttachment, 'thumbnail')
          ),
        }
      : undefined;
    dataToSaveAsJSON.contact = message.contact?.map(contact => ({
      ...contact,
      avatar: omit(contact.avatar, 'avatar'),
    }));
    dataToSaveAsJSON.sticker = message.sticker
      ? omit(message.sticker, 'data')
      : undefined;

    dataToSaveAsJSON.editHistory = message.editHistory?.map(editHistory => {
      const editHistoryWithoutAttachments = { ...editHistory };
      delete editHistoryWithoutAttachments.attachments;
      delete editHistoryWithoutAttachments.bodyAttachment;
      editHistoryWithoutAttachments.quote = editHistory.quote
        ? {
            ...editHistory.quote,
            attachments: editHistory.quote.attachments.map(quoteAttachment =>
              omit(quoteAttachment, 'thumbnail')
            ),
          }
        : undefined;
      editHistoryWithoutAttachments.preview = editHistory.preview?.map(
        preview => omit(preview, 'image')
      );

      return editHistoryWithoutAttachments;
    });
  }

  const downloadedAttachments = message.attachments?.filter(
    attachment => attachment.path != null
  );

  const payloadWithoutJson = {
    id,
    body: body || null,
    conversationId,
    expirationStartTimestamp: expirationStartTimestamp || null,
    expireTimer: expireTimer || null,
    // TODO (DESKTOP-8711)
    hasAttachments: (downloadedAttachments?.length ?? 0) > 0 ? 1 : 0,
    hasFileAttachments: downloadedAttachments?.some(isFile) ? 1 : 0,
    hasVisualMediaAttachments: downloadedAttachments?.some(isVisualMedia)
      ? 1
      : 0,
    isChangeCreatedByUs: groupV2Change?.from === ourAci ? 1 : 0,
    isErased: isErased ? 1 : 0,
    isViewOnce: isViewOnce ? 1 : 0,
    mentionsMe: mentionsMe ? 1 : 0,
    received_at: received_at || null,
    received_at_ms: received_at_ms || null,
    schemaVersion: schemaVersion || 0,
    serverGuid: serverGuid || null,
    sent_at: sent_at || null,
    source: source || null,
    sourceServiceId: sourceServiceId || null,
    sourceDevice: sourceDevice || null,
    storyId: storyId || null,
    type: type || null,
    timestamp: timestamp ?? 0,
    readStatus: readStatus ?? null,
    seenStatus: seenStatus ?? SeenStatus.NotApplicable,
    serverTimestamp: serverTimestamp ?? null,
    unidentifiedDeliveryReceived: unidentifiedDeliveryReceived ? 1 : 0,
  } satisfies Omit<MessageTypeUnhydrated, 'json'>;

  if (id && !forceSave) {
    const result = db
      .prepare(
        // UPDATE queries that set the value of a primary key column can be very slow when
        // that key is referenced via a foreign key constraint, so we are careful to
        // exclude it here.
        `
        UPDATE messages SET
          ${MESSAGE_NON_PRIMARY_KEY_COLUMNS.map(name => `${name} = $${name}`).join(', ')}
        WHERE id = $id;
      `
      )
      .run({ ...payloadWithoutJson, json: objectToJSON(dataToSaveAsJSON) });

    if (result.changes === 0) {
      // Message has been deleted from DB
      return id;
    }

    if (normalizeAttachmentData) {
      saveMessageAttachments(db, message);
    }

    if (jobToInsert) {
      insertJob(db, jobToInsert);
    }

    strictAssert(result.changes === 1, 'One row should have been changed');

    return id;
  }

  const createdId = id || generateMessageId(message.received_at).id;

  db.prepare(
    `
    INSERT INTO messages (
      ${MESSAGE_COLUMNS.join(', ')}
    ) VALUES (
      ${MESSAGE_COLUMNS.map(name => `$${name}`).join(', ')}
    );
    `
  ).run({
    ...payloadWithoutJson,
    id: createdId,
    json: objectToJSON(dataToSaveAsJSON),
  });

  if (normalizeAttachmentData) {
    saveMessageAttachments(db, message);
  }

  if (jobToInsert) {
    insertJob(db, jobToInsert);
  }

  return createdId;
}

function saveMessages(
  db: WritableDB,
  arrayOfMessages: ReadonlyArray<ReadonlyDeep<MessageType>>,
  options: {
    forceSave?: boolean;
    ourAci: AciString;
    _testOnlyAvoidNormalizingAttachments?: boolean;
  }
): Array<string> {
  return db.transaction(() => {
    const result = new Array<string>();
    for (const message of arrayOfMessages) {
      result.push(
        saveMessage(db, message, {
          ...options,
          alreadyInTransaction: true,
        })
      );
    }
    return result;
  })();
}

function saveMessagesIndividually(
  db: WritableDB,
  arrayOfMessages: ReadonlyArray<ReadonlyDeep<MessageType>>,
  options: { forceSave?: boolean; ourAci: AciString }
): { failedIndices: Array<number> } {
  return db.transaction(() => {
    const failedIndices: Array<number> = [];
    arrayOfMessages.forEach((message, index) => {
      try {
        saveMessage(db, message, options);
      } catch (e) {
        logger.error(
          'saveMessagesIndividually: failed to save message',
          Errors.toLogFormat(e)
        );
        failedIndices.push(index);
      }
    });
    return { failedIndices };
  })();
}

function removeMessage(db: WritableDB, id: string): void {
  db.prepare('DELETE FROM messages WHERE id = $id;').run({ id });
}

function removeMessagesBatch(
  db: WritableDB,
  ids: ReadonlyArray<string>,
  persistent: boolean
): void {
  db.prepare(
    `
    DELETE FROM messages
    WHERE id IN ( ${ids.map(() => '?').join(', ')} );
    `,
    { persistent }
  ).run(ids);
}

function removeMessages(db: WritableDB, ids: ReadonlyArray<string>): void {
  batchMultiVarQuery(db, ids, (batch, persistent) =>
    removeMessagesBatch(db, batch, persistent)
  );
}

export function getMessageById(
  db: ReadableDB,
  id: string
): MessageType | undefined {
  return db.transaction(() => {
    const row = db
      .prepare(
        `
      SELECT ${MESSAGE_COLUMNS.join(', ')}
      FROM messages
      WHERE id = $id;
    `
      )
      .get<MessageTypeUnhydrated>({
        id,
      });

    if (!row) {
      return undefined;
    }

    return hydrateMessage(db, row);
  })();
}

function getMessagesById(
  db: ReadableDB,
  messageIds: ReadonlyArray<string>
): Array<MessageType> {
  return db.transaction(() =>
    batchMultiVarQuery(
      db,
      messageIds,
      (
        batch: ReadonlyArray<string>,
        persistent: boolean
      ): Array<MessageType> => {
        const query = db.prepare(
          `
          SELECT ${MESSAGE_COLUMNS.join(', ')}
          FROM messages
          WHERE id IN (
            ${Array(batch.length).fill('?').join(',')}
          );`,
          { persistent }
        );
        const rows: Array<MessageTypeUnhydrated> = query.all(batch);
        return hydrateMessages(db, rows);
      }
    )
  )();
}

function _getAllMessages(db: ReadableDB): Array<MessageType> {
  return db.transaction(() => {
    const rows: Array<MessageTypeUnhydrated> = db
      .prepare(
        `
      SELECT ${MESSAGE_COLUMNS.join(', ')}
      FROM messages ORDER BY id ASC
    `
      )
      .all();

    return hydrateMessages(db, rows);
  })();
}

function _removeAllMessages(db: WritableDB): void {
  db.exec(`
    DELETE FROM messages;
    INSERT INTO messages_fts(messages_fts) VALUES('optimize');
  `);
}

function getAllMessageIds(db: ReadableDB): Array<string> {
  const rows: Array<{ id: string }> = db
    .prepare('SELECT id FROM messages ORDER BY id ASC;')
    .all();

  return rows.map(row => row.id);
}

function getMessageBySender(
  db: ReadableDB,
  {
    source,
    sourceServiceId,
    sourceDevice,
    sent_at,
  }: {
    source?: string;
    sourceServiceId?: ServiceIdString;
    sourceDevice?: number;
    sent_at: number;
  }
): MessageType | undefined {
  return db.transaction(() => {
    const rows: Array<MessageTypeUnhydrated> = db
      .prepare(
        `
    SELECT ${MESSAGE_COLUMNS.join(', ')} FROM messages WHERE
      (source = $source OR sourceServiceId = $sourceServiceId) AND
      sourceDevice = $sourceDevice AND
      sent_at = $sent_at
    LIMIT 2;
    `
      )
      .all({
        source: source || null,
        sourceServiceId: sourceServiceId || null,
        sourceDevice: sourceDevice || null,
        sent_at,
      });

    if (rows.length > 1) {
      logger.warn('getMessageBySender: More than one message found for', {
        sent_at,
        source,
        sourceServiceId,
        sourceDevice,
      });
    }

    if (rows.length < 1) {
      return undefined;
    }

    return hydrateMessage(db, rows[0]);
  })();
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
    return sqlFragment`NULL IS NULL`;
  }

  // In contrast to: replies to a specific story
  return sqlFragment`storyId IS ${storyId ?? null}`;
}

function getUnreadByConversationAndMarkRead(
  db: WritableDB,
  {
    conversationId,
    includeStoryReplies,
    readMessageReceivedAt,
    storyId,
    readAt,
    now = Date.now(),
  }: {
    conversationId: string;
    includeStoryReplies: boolean;
    readMessageReceivedAt: number;
    storyId?: string;
    readAt?: number;
    now?: number;
  }
): GetUnreadByConversationAndMarkReadResultType {
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
        received_at <= ${readMessageReceivedAt};
    `;

    db.prepare(updateExpirationQuery).run(updateExpirationParams);

    const [selectQuery, selectParams] = sql`
      SELECT
        ${sqlJoin(MESSAGE_COLUMNS_FRAGMENTS)}
        FROM messages
        WHERE
          conversationId = ${conversationId} AND
          seenStatus = ${SeenStatus.Unseen} AND
          isStory = 0 AND
          (${_storyIdPredicate(storyId, includeStoryReplies)}) AND
          received_at <= ${readMessageReceivedAt}
        ORDER BY received_at DESC, sent_at DESC;
    `;

    const rows = db
      .prepare(selectQuery)
      .all<MessageTypeUnhydrated>(selectParams);

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
          received_at <= ${readMessageReceivedAt};
    `;

    db.prepare(updateStatusQuery).run(updateStatusParams);
    return hydrateMessages(db, rows).map(msg => {
      return {
        originalReadStatus: msg.readStatus,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        ...pick(msg, [
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

function getUnreadReactionsAndMarkRead(
  db: WritableDB,
  {
    conversationId,
    readMessageReceivedAt,
    storyId,
  }: {
    conversationId: string;
    readMessageReceivedAt: number;
    storyId?: string;
  }
): Array<ReactionResultType> {
  return db.transaction(() => {
    const unreadMessages: Array<ReactionResultType> = db
      .prepare(
        `
        SELECT reactions.rowid, targetAuthorAci, targetTimestamp, messageId
        FROM reactions
        INDEXED BY reactions_unread
        JOIN messages on messages.id IS reactions.messageId
        WHERE
          reactions.conversationId IS $conversationId AND
          reactions.unread > 0 AND
          messages.received_at <= $readMessageReceivedAt AND
          messages.storyId IS $storyId
        ORDER BY messageReceivedAt DESC;
      `
      )
      .all({
        conversationId,
        readMessageReceivedAt,
        storyId: storyId || null,
      });

    const idsToUpdate = unreadMessages.map(item => item.rowid);
    batchMultiVarQuery(
      db,
      idsToUpdate,
      (ids: ReadonlyArray<number>, persistent: boolean): void => {
        db.prepare(
          `
        UPDATE reactions
        SET unread = 0
        WHERE rowid IN ( ${ids.map(() => '?').join(', ')} );
        `,
          { persistent }
        ).run(ids);
      }
    );

    return unreadMessages;
  })();
}

function markReactionAsRead(
  db: WritableDB,
  targetAuthorServiceId: ServiceIdString,
  targetTimestamp: number
): ReactionType | undefined {
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
      .get<ReactionType>({
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

function getReactionByTimestamp(
  db: ReadableDB,
  fromId: string,
  timestamp: number
): ReactionType | undefined {
  const [query, params] = sql`
    SELECT * FROM reactions
    WHERE fromId IS ${fromId} AND timestamp IS ${timestamp}
  `;

  return db.prepare(query).get(params);
}

function addReaction(
  db: WritableDB,
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
): void {
  db.prepare(
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
  ).run({
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

function removeReactionFromConversation(
  db: WritableDB,
  {
    emoji,
    fromId,
    targetAuthorServiceId,
    targetTimestamp,
  }: {
    emoji: string;
    fromId: string;
    targetAuthorServiceId: ServiceIdString;
    targetTimestamp: number;
  }
): void {
  db.prepare(
    `DELETE FROM reactions WHERE
      emoji = $emoji AND
      fromId = $fromId AND
      targetAuthorAci = $targetAuthorAci AND
      targetTimestamp = $targetTimestamp;`
  ).run({
    emoji,
    fromId,
    targetAuthorAci: targetAuthorServiceId,
    targetTimestamp,
  });
}

function _getAllReactions(db: ReadableDB): Array<ReactionType> {
  return db.prepare('SELECT * from reactions;').all();
}
function _removeAllReactions(db: WritableDB): void {
  db.prepare('DELETE from reactions;').run();
}

enum AdjacentDirection {
  Older = 'Older',
  Newer = 'Newer',
}

// This function needs to pull story replies from all conversations, because when we send
//   a story to one or more distribution lists, each reply to it will be in the sender's
//   1:1 conversation with us.
function getRecentStoryReplies(
  db: ReadableDB,
  storyId: string,
  {
    limit = 100,
    messageId,
    receivedAt = Number.MAX_VALUE,
    sentAt = Number.MAX_VALUE,
  }: GetRecentStoryRepliesOptionsType = {}
): Array<MessageType> {
  const timeFilters = {
    first: sqlFragment`received_at = ${receivedAt} AND sent_at < ${sentAt}`,
    second: sqlFragment`received_at < ${receivedAt}`,
  };

  const createQuery = (timeFilter: QueryFragment): QueryFragment => sqlFragment`
    SELECT
      ${sqlJoin(MESSAGE_COLUMNS_FRAGMENTS)}
    FROM messages
    WHERE
      (${messageId ?? null} IS NULL OR id IS NOT ${messageId ?? null}) AND
      isStory IS 0 AND
      storyId IS ${storyId} AND
      (
        ${timeFilter}
      )
      ORDER BY received_at DESC, sent_at DESC
  `;

  const template = sqlFragment`
    SELECT first.* FROM (${createQuery(timeFilters.first)}) as first
    UNION ALL
    SELECT second.* FROM (${createQuery(timeFilters.second)}) as second
  `;

  const [query, params] = sql`${template} LIMIT ${limit}`;

  return db.transaction(() => {
    const rows: Array<MessageTypeUnhydrated> = db.prepare(query).all(params);
    return hydrateMessages(db, rows);
  })();
}

function getAdjacentMessagesByConversation(
  db: ReadableDB,
  direction: AdjacentDirection,
  {
    conversationId,
    includeStoryReplies,
    limit = 100,
    messageId,
    receivedAt = direction === AdjacentDirection.Older ? Number.MAX_VALUE : 0,
    sentAt = direction === AdjacentDirection.Older ? Number.MAX_VALUE : 0,
    requireVisualMediaAttachments,
    requireFileAttachments,
    storyId,
  }: AdjacentMessagesByConversationOptionsType
): Array<MessageType> {
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
    direction === AdjacentDirection.Older ||
    requireVisualMediaAttachments ||
    requireFileAttachments;

  const createQuery = (timeFilter: QueryFragment): QueryFragment => sqlFragment`
    SELECT
      ${sqlJoin(MESSAGE_COLUMNS_FRAGMENTS)}
    FROM messages WHERE
      conversationId = ${conversationId} AND
      ${
        requireDifferentMessage
          ? sqlFragment`(${messageId ?? null} IS NULL OR id IS NOT ${messageId ?? null}) AND`
          : sqlFragment``
      }
      ${
        requireVisualMediaAttachments
          ? sqlFragment`hasVisualMediaAttachments IS 1 AND isViewOnce IS 0 AND`
          : sqlFragment``
      }
      ${
        requireFileAttachments
          ? sqlFragment`hasFileAttachments IS 1 AND isViewOnce IS 0 AND`
          : sqlFragment``
      }
      isStory IS 0 AND
      (${_storyIdPredicate(storyId, includeStoryReplies)}) AND
      (
        ${timeFilter}
      )
      ORDER BY received_at ${timeOrder}, sent_at ${timeOrder}
  `;

  const [query, params] = sql`
    SELECT first.* FROM (${createQuery(timeFilters.first)}) as first
    UNION ALL
    SELECT second.* FROM (${createQuery(timeFilters.second)}) as second
    LIMIT ${limit}
  `;

  return db.transaction(() => {
    const results = db.prepare(query).all<MessageTypeUnhydrated>(params);

    if (direction === AdjacentDirection.Older) {
      results.reverse();
    }

    return hydrateMessages(db, results);
  })();
}

function getOlderMessagesByConversation(
  db: ReadableDB,
  options: AdjacentMessagesByConversationOptionsType
): Array<MessageType> {
  return getAdjacentMessagesByConversation(
    db,
    AdjacentDirection.Older,
    options
  );
}

function getAllStories(
  db: ReadableDB,
  {
    conversationId,
    sourceServiceId,
  }: {
    conversationId?: string;
    sourceServiceId?: ServiceIdString;
  }
): GetAllStoriesResultType {
  return db.transaction(() => {
    const [storiesQuery, storiesParams] = sql`
    SELECT ${sqlJoin(MESSAGE_COLUMNS_FRAGMENTS)}
    FROM messages
    WHERE
      isStory = 1 AND
      (${conversationId ?? null} IS NULL OR
        conversationId IS ${conversationId ?? null}) AND
      (${sourceServiceId ?? null} IS NULL OR
        sourceServiceId IS ${sourceServiceId ?? null})
    ORDER BY received_at ASC, sent_at ASC;
  `;
    const rows = db
      .prepare(storiesQuery)
      .all<MessageTypeUnhydrated>(storiesParams);

    const [repliesQuery, repliesParams] = sql`
    SELECT DISTINCT storyId
    FROM messages
    WHERE storyId IS NOT NULL
  `;
    const replies = db
      .prepare(repliesQuery, { pluck: true })
      .all<string>(repliesParams);

    const [repliesFromSelfQuery, repliesFromSelfParams] = sql`
    SELECT DISTINCT storyId
    FROM messages
    WHERE (
      storyId IS NOT NULL AND
      type IS 'outgoing'
    )
  `;
    const repliesFromSelf = db
      .prepare(repliesFromSelfQuery, {
        pluck: true,
      })
      .all<string>(repliesFromSelfParams);

    const repliesLookup = new Set(replies);
    const repliesFromSelfLookup = new Set(repliesFromSelf);

    return hydrateMessages(db, rows).map(msg => ({
      ...msg,
      hasReplies: Boolean(repliesLookup.has(msg.id)),
      hasRepliesFromSelf: Boolean(repliesFromSelfLookup.has(msg.id)),
    }));
  })();
}

function getNewerMessagesByConversation(
  db: ReadableDB,
  options: AdjacentMessagesByConversationOptionsType
): Array<MessageType> {
  return getAdjacentMessagesByConversation(
    db,
    AdjacentDirection.Newer,
    options
  );
}
function getOldestMessageForConversation(
  db: ReadableDB,
  conversationId: string,
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): MessageMetricsType | undefined {
  const [query, params] = sql`
    SELECT received_at, sent_at, id FROM messages WHERE
        conversationId = ${conversationId} AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, includeStoryReplies)})
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
  `;

  const row = db.prepare(query).get<{
    received_at: number;
    sent_at: number;
    id: string;
  }>(params);

  if (!row) {
    return undefined;
  }

  return row;
}
function getNewestMessageForConversation(
  db: ReadableDB,
  conversationId: string,
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): MessageMetricsType | undefined {
  const [query, params] = sql`
    SELECT received_at, sent_at, id FROM messages WHERE
        conversationId = ${conversationId} AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, includeStoryReplies)})
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
  `;
  const row = db.prepare(query).get<{
    received_at: number;
    sent_at: number;
    id: string;
  }>(params);

  if (!row) {
    return undefined;
  }

  return row;
}

function getMessagesBetween(
  db: ReadableDB,
  conversationId: string,
  options: GetMessagesBetweenOptions
): Array<string> {
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

  const rows = db.prepare(query).all<{ id: string }>(params);

  return rows.map(row => row.id);
}

/**
 * Given a set of deleted message IDs, find a message in the conversation that
 * is close to the set. Searching from the last selected message as a starting
 * point.
 */
function getNearbyMessageFromDeletedSet(
  db: ReadableDB,
  {
    conversationId,
    lastSelectedMessage,
    deletedMessageIds,
    storyId,
    includeStoryReplies,
  }: GetNearbyMessageFromDeletedSetOptionsType
): string | null {
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

    return db
      .prepare(query, {
        pluck: true,
      })
      .get<string>(params);
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

function getLastConversationActivity(
  db: ReadableDB,
  {
    conversationId,
    includeStoryReplies,
  }: {
    conversationId: string;
    includeStoryReplies: boolean;
  }
): MessageType | undefined {
  return db.transaction(() => {
    const row = db
      .prepare(
        `
      SELECT ${MESSAGE_COLUMNS.join(', ')} FROM messages
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
      )
      .get<MessageTypeUnhydrated>({
        conversationId,
      });

    if (!row) {
      return undefined;
    }

    return hydrateMessage(db, row);
  })();
}
function getLastConversationPreview(
  db: ReadableDB,
  {
    conversationId,
    includeStoryReplies,
  }: {
    conversationId: string;
    includeStoryReplies: boolean;
  }
): MessageType | undefined {
  const index = includeStoryReplies
    ? 'messages_preview'
    : 'messages_preview_without_story';

  return db.transaction(() => {
    const row: MessageTypeUnhydrated | undefined = db
      .prepare(
        `
      SELECT ${MESSAGE_COLUMNS.join(', ')}, expiresAt FROM (
        SELECT ${MESSAGE_COLUMNS.join(', ')}, expiresAt FROM messages
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
      )
      .get({
        conversationId,
        now: Date.now(),
      });

    return row ? hydrateMessage(db, row) : undefined;
  })();
}

function getConversationMessageStats(
  db: ReadableDB,
  {
    conversationId,
    includeStoryReplies,
  }: {
    conversationId: string;
    includeStoryReplies: boolean;
  }
): ConversationMessageStatsType {
  return db.transaction(() => {
    return {
      activity: getLastConversationActivity(db, {
        conversationId,
        includeStoryReplies,
      }),
      preview: getLastConversationPreview(db, {
        conversationId,
        includeStoryReplies,
      }),
      hasUserInitiatedMessages: hasUserInitiatedMessages(db, conversationId),
    };
  })();
}

function getLastConversationMessage(
  db: ReadableDB,
  {
    conversationId,
  }: {
    conversationId: string;
  }
): MessageType | undefined {
  return db.transaction(() => {
    const row = db
      .prepare(
        `
      SELECT ${MESSAGE_COLUMNS.join(', ')} FROM messages WHERE
        conversationId = $conversationId
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
      `
      )
      .get<MessageTypeUnhydrated>({
        conversationId,
      });

    if (!row) {
      return undefined;
    }

    return hydrateMessage(db, row);
  })();
}

function getOldestUnseenMessageForConversation(
  db: ReadableDB,
  conversationId: string,
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): MessageMetricsType | undefined {
  const [query, params] = sql`
    SELECT received_at, sent_at, id FROM messages WHERE
      conversationId = ${conversationId} AND
      seenStatus = ${SeenStatus.Unseen} AND
      isStory IS 0 AND
      (${_storyIdPredicate(storyId, includeStoryReplies)})
    ORDER BY received_at ASC, sent_at ASC
    LIMIT 1;
  `;

  const row = db
    .prepare(query)
    .get<{ received_at: number; sent_at: number; id: string }>(params);

  if (!row) {
    return undefined;
  }

  return row;
}

function getOldestUnreadMentionOfMeForConversation(
  db: ReadableDB,
  conversationId: string,
  options: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): MessageMetricsType | undefined {
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

function getTotalUnreadForConversation(
  db: ReadableDB,
  conversationId: string,
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId: string | undefined;
    includeStoryReplies: boolean;
  }
): number {
  const [query, params] = sql`
    SELECT count(1)
    FROM messages
    WHERE
      conversationId = ${conversationId} AND
      readStatus = ${ReadStatus.Unread} AND
      isStory IS 0 AND
      (${_storyIdPredicate(storyId, includeStoryReplies)})
  `;
  const row = db
    .prepare(query, {
      pluck: true,
    })
    .get<number>(params);

  return row ?? 0;
}
function getTotalUnreadMentionsOfMeForConversation(
  db: ReadableDB,
  conversationId: string,
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): number {
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
  const row = db
    .prepare(query, {
      pluck: true,
    })
    .get<number>(params);

  return row ?? 0;
}
function getTotalUnseenForConversation(
  db: ReadableDB,
  conversationId: string,
  {
    storyId,
    includeStoryReplies,
  }: {
    storyId?: string;
    includeStoryReplies: boolean;
  }
): number {
  const [query, params] = sql`
    SELECT count(1)
      FROM messages
      WHERE
        conversationId = ${conversationId} AND
        seenStatus = ${SeenStatus.Unseen} AND
        isStory IS 0 AND
        (${_storyIdPredicate(storyId, includeStoryReplies)})
  `;
  const row = db
    .prepare(query, {
      pluck: true,
    })
    .get<number>(params);

  return row ?? 0;
}

function getMessageMetricsForConversation(
  db: ReadableDB,
  options: {
    conversationId: string;
    storyId?: string;
    includeStoryReplies: boolean;
  }
): ConversationMetricsType {
  const { conversationId } = options;
  const oldest = getOldestMessageForConversation(db, conversationId, options);
  const newest = getNewestMessageForConversation(db, conversationId, options);
  const oldestUnseen = getOldestUnseenMessageForConversation(
    db,
    conversationId,
    options
  );
  const totalUnseen = getTotalUnseenForConversation(
    db,
    conversationId,
    options
  );

  return {
    oldest,
    newest,
    oldestUnseen,
    totalUnseen,
  };
}

function getConversationRangeCenteredOnMessage(
  db: ReadableDB,
  options: AdjacentMessagesByConversationOptionsType
): GetConversationRangeCenteredOnMessageResultType<MessageType> {
  return db.transaction(() => {
    return {
      older: getAdjacentMessagesByConversation(
        db,
        AdjacentDirection.Older,
        options
      ),
      newer: getAdjacentMessagesByConversation(
        db,
        AdjacentDirection.Newer,
        options
      ),
      metrics: getMessageMetricsForConversation(db, options),
    };
  })();
}

function getAllCallHistory(db: ReadableDB): ReadonlyArray<CallHistoryDetails> {
  const [query] = sql`
    SELECT * FROM callsHistory;
  `;
  return db.prepare(query).all();
}

function _removeAllCallHistory(db: WritableDB): void {
  const [query, params] = sql`
    DELETE FROM callsHistory;
  `;
  db.prepare(query).run(params);
}

/**
 * Deletes call history by marking it deleted. Tombstoning is needed in case sync messages
 * come in around the same time, to prevent reappearance of deleted call history.
 * Limitation: History for admin call links is skipped. Admin call links need to be
 * deleted on the calling server first, before we can clear local history.
 *
 *  @returns ReadonlyArray<string>: message ids of call history messages
 */
function clearCallHistory(
  db: WritableDB,
  target: CallLogEventTarget
): ReadonlyArray<string> {
  return db.transaction(() => {
    const callHistory = getCallHistoryForCallLogEventTarget(db, target);
    if (callHistory == null) {
      logger.warn('clearCallHistory: Target call not found');
      return [];
    }
    const { timestamp } = callHistory;

    // Admin call links are deleted separately after server confirmation
    const [selectAdminCallLinksQuery, selectAdminCallLinksParams] = sql`
      SELECT roomId
      FROM callLinks
      WHERE callLinks.adminKey IS NOT NULL;
    `;

    const adminCallLinkIds: ReadonlyArray<string> = db
      .prepare(selectAdminCallLinksQuery, {
        pluck: true,
      })
      .all(selectAdminCallLinksParams);
    const adminCallLinkIdsFragment = sqlJoin(adminCallLinkIds);

    const [selectCallsQuery, selectCallsParams] = sql`
      SELECT callsHistory.callId
      FROM callsHistory
      WHERE
        (
          -- Prior calls
          (callsHistory.timestamp <= ${timestamp})
          -- Unused call links
          OR (
            callsHistory.mode IS ${CALL_MODE_ADHOC} AND
            callsHistory.status IS ${CALL_STATUS_PENDING}
          )
        ) AND
        callsHistory.peerId NOT IN (${adminCallLinkIdsFragment});
    `;

    const deletedCallIds: ReadonlyArray<string> = db
      .prepare(selectCallsQuery, {
        pluck: true,
      })
      .all(selectCallsParams);

    let deletedMessageIds: ReadonlyArray<string> = [];

    batchMultiVarQuery(db, deletedCallIds, (ids, persistent): void => {
      const idsFragment = sqlJoin(ids);

      const [clearCallsHistoryQuery, clearCallsHistoryParams] = sql`
        UPDATE callsHistory
        SET
          status = ${DirectCallStatus.Deleted},
          timestamp = ${Date.now()}
        WHERE callsHistory.callId IN (${idsFragment});
      `;

      db.prepare(clearCallsHistoryQuery, { persistent }).run(
        clearCallsHistoryParams
      );

      const [deleteMessagesQuery, deleteMessagesParams] = sql`
        DELETE FROM messages
        WHERE messages.type IS 'call-history'
        AND messages.callId IN (${idsFragment})
        RETURNING id;
      `;

      const batchDeletedMessageIds = db
        .prepare(deleteMessagesQuery, {
          pluck: true,
          persistent,
        })
        .all<string>(deleteMessagesParams);

      deletedMessageIds = deletedMessageIds.concat(batchDeletedMessageIds);
    });

    return deletedMessageIds;
  })();
}

function markCallHistoryDeleted(db: WritableDB, callId: string): void {
  const [query, params] = sql`
    UPDATE callsHistory
    SET
      status = ${DirectCallStatus.Deleted},
      timestamp = ${Date.now()}
    WHERE callId = ${callId}
  `;
  db.prepare(query).run(params);
}

function cleanupCallHistoryMessages(db: WritableDB): void {
  return db.transaction(() => {
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
  })();
}

function getCallHistoryMessageByCallId(
  db: ReadableDB,
  options: {
    conversationId: string;
    callId: string;
  }
): MessageType | undefined {
  return db.transaction(() => {
    const [query, params] = sql`
    SELECT ${sqlJoin(MESSAGE_COLUMNS_FRAGMENTS)}
    FROM messages
    WHERE conversationId = ${options.conversationId}
      AND type = 'call-history'
      AND callId = ${options.callId}
  `;
    const row = db.prepare(query).get<MessageTypeUnhydrated>(params);
    if (row == null) {
      return;
    }
    return hydrateMessage(db, row);
  })();
}

function getCallHistory(
  db: ReadableDB,
  callId: string,
  peerId: ServiceIdString | string
): CallHistoryDetails | undefined {
  const [query, params] = sql`
    SELECT * FROM callsHistory
    WHERE callId IS ${callId}
    AND peerId IS ${peerId};
  `;

  const row = db.prepare(query).get(params);

  if (row == null) {
    return;
  }

  return parseUnknown(callHistoryDetailsSchema, row as unknown);
}

const READ_STATUS_READ = sqlConstant(ReadStatus.Read);
const SEEN_STATUS_UNSEEN = sqlConstant(SeenStatus.Unseen);
const SEEN_STATUS_SEEN = sqlConstant(SeenStatus.Seen);
const CALL_STATUS_MISSED = sqlConstant(CallStatusValue.Missed);
const CALL_STATUS_DELETED = sqlConstant(CallStatusValue.Deleted);
const CALL_STATUS_PENDING = sqlConstant(CallStatusValue.Pending);
const CALL_STATUS_INCOMING = sqlConstant(CallDirection.Incoming);
const CALL_MODE_ADHOC = sqlConstant(CallMode.Adhoc);
const FOUR_HOURS_IN_MS = sqlConstant(4 * 60 * 60 * 1000);

function getCallHistoryUnreadCount(db: ReadableDB): number {
  const [query, params] = sql`
    SELECT count(*) FROM messages
    INNER JOIN callsHistory ON callsHistory.callId = messages.callId
    WHERE messages.type IS 'call-history'
      AND messages.seenStatus IS ${SEEN_STATUS_UNSEEN}
      AND callsHistory.status IS ${CALL_STATUS_MISSED}
      AND callsHistory.direction IS ${CALL_STATUS_INCOMING}
  `;
  const row = db
    .prepare(query, {
      pluck: true,
    })
    .get<number>(params);
  return row ?? 0;
}

function markCallHistoryRead(db: WritableDB, callId: string): void {
  const jsonPatch = JSON.stringify({
    seenStatus: SeenStatus.Seen,
  });

  const [query, params] = sql`
    UPDATE messages
    SET
      seenStatus = ${SEEN_STATUS_SEEN},
      json = json_patch(json, ${jsonPatch})
    WHERE type IS 'call-history'
    AND callId IS ${callId}
  `;
  db.prepare(query).run(params);
}

function getCallHistoryForCallLogEventTarget(
  db: ReadableDB,
  target: CallLogEventTarget
): CallHistoryDetails | null {
  const { callId, timestamp } = target;

  if ('peerId' in target) {
    const { peerId } = target;

    let row: unknown;

    if (callId == null || peerId == null) {
      const predicate =
        peerId != null
          ? sqlFragment`callsHistory.peerId IS ${target.peerId}`
          : sqlFragment`TRUE`;

      // Get the most recent call history timestamp for the target.timestamp
      const [selectQuery, selectParams] = sql`
        SELECT *
        FROM callsHistory
        WHERE ${predicate}
          AND callsHistory.timestamp <= ${timestamp}
        ORDER BY callsHistory.timestamp DESC
        LIMIT 1
      `;

      row = db.prepare(selectQuery).get(selectParams);
    } else {
      const [selectQuery, selectParams] = sql`
        SELECT *
        FROM callsHistory
        WHERE callsHistory.peerId IS ${target.peerId}
          AND callsHistory.callId IS ${target.callId}
        LIMIT 1
      `;

      row = db.prepare(selectQuery).get(selectParams);
    }

    if (row == null) {
      return null;
    }

    return parseUnknown(callHistoryDetailsSchema, row as unknown);
  }

  // For incoming CallLogEvent sync messages, peerId is ambiguous whether it
  // refers to conversation or call link.
  if ('peerIdAsConversationId' in target && 'peerIdAsRoomId' in target) {
    const resultForConversation = getCallHistoryForCallLogEventTarget(db, {
      callId,
      timestamp,
      peerId: target.peerIdAsConversationId,
    });
    if (resultForConversation) {
      return resultForConversation;
    }

    const resultForCallLink = getCallHistoryForCallLogEventTarget(db, {
      callId,
      timestamp,
      peerId: target.peerIdAsRoomId,
    });
    if (resultForCallLink) {
      return resultForCallLink;
    }

    return null;
  }

  throw new Error(
    'Either peerId, or peerIdAsConversationId and peerIdAsRoomId must be present'
  );
}

function getConversationIdForCallHistory(
  db: ReadableDB,
  callHistory: CallHistoryDetails
): string | null {
  const { peerId, mode } = callHistory;

  if (mode === CallMode.Adhoc) {
    throw new Error(
      'getConversationIdForCallHistory: Adhoc calls do not have conversations'
    );
  }

  const predicate =
    mode === CallMode.Direct
      ? sqlFragment`serviceId IS ${peerId}`
      : sqlFragment`groupId IS ${peerId}`;

  const [selectConversationIdQuery, selectConversationIdParams] = sql`
    SELECT id FROM conversations
    WHERE ${predicate}
  `;

  const conversationId = db
    .prepare(selectConversationIdQuery, {
      pluck: true,
    })
    .get(selectConversationIdParams);

  if (typeof conversationId !== 'string') {
    logger.warn('getConversationIdForCallHistory: Unknown conversation');
    return null;
  }

  return conversationId ?? null;
}

function getMessageReceivedAtForCall(
  db: ReadableDB,
  callId: string,
  conversationId: string
): number | undefined {
  const [selectQuery, selectParams] = sql`
    SELECT messages.received_at
    FROM messages
    WHERE messages.type IS 'call-history'
      AND messages.conversationId IS ${conversationId}
      AND messages.callId IS ${callId}
    LIMIT 1
  `;

  const receivedAt = db
    .prepare(selectQuery, {
      pluck: true,
    })
    .get<number>(selectParams);
  if (receivedAt == null) {
    logger.warn('getMessageReceivedAtForCall: Target call message not found');
    return undefined;
  }

  return receivedAt;
}

export function markAllCallHistoryRead(
  db: WritableDB,
  target: CallLogEventTarget,
  inConversation = false
): number {
  return db.transaction(() => {
    const callHistory = getCallHistoryForCallLogEventTarget(db, target);
    if (callHistory == null) {
      logger.warn('markAllCallHistoryRead: Target call not found');
      return 0;
    }

    const { callId } = callHistory;

    strictAssert(
      target.callId == null || callId === target.callId,
      'Call ID must be the same as target if supplied'
    );

    let predicate: QueryFragment;
    let receivedAt: number | undefined;
    if (callHistory.mode === CallMode.Adhoc) {
      // If the target is a call link, there's no associated conversation and messages,
      // and we can only mark call history read based on timestamp.
      strictAssert(
        !inConversation,
        'markAllCallHistoryRead: Not possible to mark read in conversation for Adhoc calls'
      );

      receivedAt = callHistory.timestamp;
      predicate = sqlFragment`TRUE`;
    } else {
      const conversationId = getConversationIdForCallHistory(db, callHistory);
      if (conversationId == null) {
        logger.warn('markAllCallHistoryRead: Conversation not found for call');
        return 0;
      }

      logger.info(
        `markAllCallHistoryRead: Found conversation ${conversationId}`
      );
      receivedAt = getMessageReceivedAtForCall(db, callId, conversationId);

      predicate = inConversation
        ? sqlFragment`messages.conversationId IS ${conversationId}`
        : sqlFragment`TRUE`;
    }

    if (receivedAt == null) {
      logger.warn('markAllCallHistoryRead: Message not found for call');
      return 0;
    }

    const jsonPatch = JSON.stringify({
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.Seen,
    });

    logger.info(
      `markAllCallHistoryRead: Marking calls before ${receivedAt} read`
    );

    const [updateQuery, updateParams] = sql`
      UPDATE messages
      SET
        readStatus = ${READ_STATUS_READ},
        seenStatus = ${SEEN_STATUS_SEEN},
        json = json_patch(json, ${jsonPatch})
      WHERE messages.type IS 'call-history'
        AND ${predicate}
        AND messages.seenStatus IS ${SEEN_STATUS_UNSEEN}
        AND messages.received_at <= ${receivedAt};
    `;

    const result = db.prepare(updateQuery).run(updateParams);
    return result.changes;
  })();
}

function markAllCallHistoryReadInConversation(
  db: WritableDB,
  target: CallLogEventTarget
): number {
  return markAllCallHistoryRead(db, target, true);
}

function getCallHistoryGroupData(
  db: WritableDB,
  isCount: boolean,
  filter: CallHistoryFilter,
  pagination: CallHistoryPagination
): unknown {
  return db.transaction(() => {
    const { limit, offset } = pagination;
    const { status, conversationIds, callLinkRoomIds } = filter;

    const isUsingTempTable = conversationIds != null || callLinkRoomIds != null;
    if (isUsingTempTable) {
      const [createTempTable] = sql`
        CREATE TEMP TABLE temp_callHistory_filtered_peers (
          conversationId TEXT,
          serviceId TEXT,
          groupId TEXT,
          callLinkRoomId TEXT
        );
      `;

      db.exec(createTempTable);
      if (conversationIds != null) {
        strictAssert(conversationIds.length > 0, "can't filter by empty array");

        batchMultiVarQuery(db, conversationIds, (ids, persistent) => {
          const idList = sqlJoin(ids.map(id => sqlFragment`${id}`));

          const [insertQuery, insertParams] = sql`
            INSERT INTO temp_callHistory_filtered_peers
              (conversationId, serviceId, groupId)
            SELECT id, serviceId, groupId
            FROM conversations
            WHERE conversations.id IN (${idList});
          `;

          db.prepare(insertQuery, { persistent }).run(insertParams);
        });
      }

      if (callLinkRoomIds != null) {
        strictAssert(callLinkRoomIds.length > 0, "can't filter by empty array");

        batchMultiVarQuery(db, callLinkRoomIds, (ids, persistent) => {
          const idList = sqlJoin(ids.map(id => sqlFragment`(${id})`));

          const [insertQuery, insertParams] = sql`
            INSERT INTO temp_callHistory_filtered_peers
              (callLinkRoomId)
            VALUES ${idList};
          `;

          db.prepare(insertQuery, { persistent }).run(insertParams);
        });
      }
    }

    // peerId can be a conversation id (legacy), a serviceId, groupId, or call
    // link roomId
    const innerJoin = isUsingTempTable
      ? sqlFragment`
          INNER JOIN temp_callHistory_filtered_peers ON (
            temp_callHistory_filtered_peers.conversationId IS c.peerId
            OR temp_callHistory_filtered_peers.serviceId IS c.peerId
            OR temp_callHistory_filtered_peers.groupId IS c.peerId
            OR temp_callHistory_filtered_peers.callLinkRoomId IS c.peerId
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

    // COUNT(*) OVER(): As a result of GROUP BY in the query (to limit adhoc
    // call history to the single latest call), COUNT(*) changes to counting
    // each group's counts rather than the total number of rows. Example: Say
    // we have 2 group calls (A and B) and 10 adhoc calls on a single link.
    // COUNT(*) ... GROUP BY returns [1, 1, 10] corresponding with callId A,
    // callId B, adhoc peerId (the GROUP conditions). However we want COUNT(*)
    // to do the normal thing and return total rows (so in the example above
    // we want 3). COUNT(*) OVER achieves this.
    const projection = isCount
      ? sqlFragment`COUNT(*) OVER() AS count`
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
      GROUP BY
        CASE
          -- By spec, limit adhoc call history to the most recent call
          WHEN mode IS ${CALL_MODE_ADHOC} THEN peerId
          ELSE callId
        END
      ORDER BY parentCallAndGroupInfo.timestamp DESC
      ${offsetLimit};
    `;

    const result = isCount
      ? db
          .prepare(query, {
            pluck: true,
          })
          .get(params)
      : db.prepare(query).all(params);

    if (isUsingTempTable) {
      const [dropTempTableQuery] = sql`
        DROP TABLE temp_callHistory_filtered_peers;
      `;

      db.exec(dropTempTableQuery);
    }

    return result;
  })();
}

const countSchema = z.number().int().nonnegative();

function getCallHistoryGroupsCount(
  db: ReadableDB,
  filter: CallHistoryFilter
): number {
  // getCallHistoryGroupData creates a temporary table and thus requires
  // write access.
  const writable = toUnsafeWritableDB(db, 'only temp table use');
  const result = getCallHistoryGroupData(writable, true, filter, {
    limit: 0,
    offset: 0,
  });

  if (result == null) {
    return 0;
  }

  return parseUnknown(countSchema, result as unknown);
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

function getCallHistoryGroups(
  db: ReadableDB,
  filter: CallHistoryFilter,
  pagination: CallHistoryPagination
): Array<CallHistoryGroup> {
  // getCallHistoryGroupData creates a temporary table and thus requires
  // write access.
  const writable = toUnsafeWritableDB(db, 'only temp table use');
  const groupsData = parseUnknown(
    groupsDataSchema,
    getCallHistoryGroupData(writable, false, filter, pagination)
  );

  const taken = new Set<string>();

  return groupsData
    .map(groupData => {
      return {
        ...groupData,
        possibleChildren: parseUnknown(
          possibleChildrenSchema,
          JSON.parse(groupData.possibleChildren) as unknown
        ),
        inPeriod: new Set(groupData.inPeriod.split(',')),
      };
    })
    .reverse()
    .map(group => {
      const { possibleChildren, inPeriod, type, ...rest } = group;
      const children = [];

      for (const child of possibleChildren) {
        if (!taken.has(child.callId) && inPeriod.has(child.callId)) {
          children.push(child);
          taken.add(child.callId);
          if (type === CallType.Adhoc) {
            // By spec, limit adhoc call history to the most recent call
            break;
          }
        }
      }

      return parseStrict(callHistoryGroupSchema, { ...rest, type, children });
    })
    .reverse();
}

function saveCallHistory(
  db: WritableDB,
  callHistory: CallHistoryDetails
): void {
  const [insertQuery, insertParams] = sql`
    INSERT OR REPLACE INTO callsHistory (
      callId,
      peerId,
      ringerId,
      startedById,
      mode,
      type,
      direction,
      status,
      timestamp,
      endedTimestamp
    ) VALUES (
      ${callHistory.callId},
      ${callHistory.peerId},
      ${callHistory.ringerId},
      ${callHistory.startedById},
      ${callHistory.mode},
      ${callHistory.type},
      ${callHistory.direction},
      ${callHistory.status},
      ${callHistory.timestamp},
      ${callHistory.endedTimestamp}
    );
  `;

  db.prepare(insertQuery).run(insertParams);
}

function hasGroupCallHistoryMessage(
  db: ReadableDB,
  conversationId: string,
  eraId: string
): boolean {
  const exists = db
    .prepare(
      `
      SELECT EXISTS(
        SELECT 1 FROM messages
        WHERE conversationId = $conversationId
        AND type = 'call-history'
        AND json_extract(json, '$.callHistoryDetails.callMode') = 'Group'
        AND json_extract(json, '$.callHistoryDetails.eraId') = $eraId
      );
      `,
      {
        pluck: true,
      }
    )
    .get<number>({
      conversationId,
      eraId,
    });

  return exists === 1;
}

function hasMedia(db: ReadableDB, conversationId: string): boolean {
  const [query, params] = sql`
    SELECT EXISTS(
      SELECT 1 FROM message_attachments
      INDEXED BY message_attachments_getOlderMedia
      WHERE
        conversationId IS ${conversationId} AND
        editHistoryIndex IS -1 AND
        attachmentType IS 'attachment' AND
        messageType IN ('incoming', 'outgoing') AND
        isViewOnce IS NOT 1 AND
        contentType IS NOT NULL AND
        contentType IS NOT '' AND
        contentType IS NOT 'text/x-signal-plain' AND
        contentType NOT LIKE 'audio/%'
    );
  `;
  const exists = db.prepare(query, { pluck: true }).get<number>(params);

  return exists === 1;
}

function getOlderMedia(
  db: ReadableDB,
  {
    conversationId,
    limit,
    messageId,
    receivedAt: maxReceivedAt = Number.MAX_VALUE,
    sentAt: maxSentAt = Number.MAX_VALUE,
    type,
  }: GetOlderMediaOptionsType
): Array<MediaItemDBType> {
  const timeFilters = {
    first: sqlFragment`receivedAt = ${maxReceivedAt} AND sentAt < ${maxSentAt}`,
    second: sqlFragment`receivedAt < ${maxReceivedAt}`,
  };

  let contentFilter: QueryFragment;
  if (type === 'media') {
    // see 'isVisualMedia' in ts/types/Attachment.ts
    contentFilter = sqlFragment`
      contentType LIKE 'image/%' OR
      contentType LIKE 'video/%'
    `;
  } else if (type === 'files') {
    // see 'isFile' in ts/types/Attachment.ts
    contentFilter = sqlFragment`
      contentType IS NOT NULL AND
      contentType IS NOT '' AND
      contentType IS NOT 'text/x-signal-plain' AND
      contentType NOT LIKE 'audio/%' AND
      contentType NOT LIKE 'image/%' AND
      contentType NOT LIKE 'video/%'
    `;
  } else {
    throw missingCaseError(type);
  }

  const createQuery = (timeFilter: QueryFragment): QueryFragment => sqlFragment`
    SELECT
      *
    FROM message_attachments
    INDEXED BY message_attachments_getOlderMedia
    WHERE
      conversationId IS ${conversationId} AND
      editHistoryIndex IS -1 AND
      attachmentType IS 'attachment' AND
      (
        ${timeFilter}
      ) AND
      (${contentFilter}) AND
      isViewOnce IS NOT 1 AND
      messageType IN ('incoming', 'outgoing') AND
      (${messageId ?? null} IS NULL OR messageId IS NOT ${messageId ?? null})
      ORDER BY receivedAt DESC, sentAt DESC
      LIMIT ${limit}
  `;

  const [query, params] = sql`
    SELECT first.* FROM (${createQuery(timeFilters.first)}) as first
    UNION ALL
    SELECT second.* FROM (${createQuery(timeFilters.second)}) as second
  `;

  const results: Array<MessageAttachmentDBType> = db.prepare(query).all(params);

  return results.map(attachment => {
    const { orderInMessage, messageType, sentAt, receivedAt, receivedAtMs } =
      attachment;

    return {
      message: {
        id: attachment.messageId,
        type: messageType as 'incoming' | 'outgoing',
        conversationId,
        receivedAt,
        receivedAtMs: receivedAtMs ?? undefined,
        sentAt,
      },
      index: orderInMessage,
      attachment: convertAttachmentDBFieldsToAttachmentType(attachment),
    };
  });
}

function _markCallHistoryMissed(
  db: WritableDB,
  callIds: ReadonlyArray<string>
) {
  batchMultiVarQuery(db, callIds, (batch, persistent) => {
    const [updateQuery, updateParams] = sql`
      UPDATE callsHistory
      SET status = ${sqlConstant(GroupCallStatus.Missed)}
      WHERE callId IN (${sqlJoin(batch)})
    `;
    return db.prepare(updateQuery, { persistent }).run(updateParams);
  });
}

function markCallHistoryMissed(
  db: WritableDB,
  callIds: ReadonlyArray<string>
): void {
  return db.transaction(() => _markCallHistoryMissed(db, callIds))();
}

function getRecentStaleRingsAndMarkOlderMissed(
  db: WritableDB
): ReadonlyArray<MaybeStaleCallHistory> {
  return db.transaction(() => {
    const [selectQuery, selectParams] = sql`
      SELECT callId, peerId FROM callsHistory
      WHERE
        type = ${sqlConstant(CallType.Group)} AND
        status = ${sqlConstant(GroupCallStatus.Ringing)}
      ORDER BY timestamp DESC
    `;

    const ringingCalls = db.prepare(selectQuery).all<{
      callId: string;
      peerId: string;
    }>(selectParams);

    const seen = new Set<string>();
    const [latestCalls, pastCalls] = partition(ringingCalls, result => {
      if (seen.size >= 10) {
        return false;
      }
      if (seen.has(result.peerId)) {
        return false;
      }
      seen.add(result.peerId);
      return true;
    });

    _markCallHistoryMissed(
      db,
      pastCalls.map(result => result.callId)
    );

    // These are returned so we can peek them.
    return latestCalls;
  })();
}

export function migrateConversationMessages(
  db: WritableDB,
  obsoleteId: string,
  currentId: string
): void {
  const PAGE_SIZE = 1000;

  const getPage = db.prepare(`
    SELECT
      rowid,
      json -> '$.sendStateByConversationId' AS sendStateJson,
      json -> '$.editHistory' AS editHistoryJson
    FROM messages
    WHERE conversationId IS $obsoleteId
    ORDER BY rowid
    LIMIT $pageSize OFFSET $offset`);

  const updateOne = db.prepare(`
    UPDATE messages
    SET
      conversationId = $currentId,
      json = json_patch(json, $patch)
    WHERE
      rowid IS $rowid
  `);

  db.transaction(() => {
    // eslint-disable-next-line no-constant-condition
    for (let offset = 0; true; offset += PAGE_SIZE) {
      const parts: Array<{
        rowid: number;
        sendStateJson?: string;
        editHistoryJson?: string;
      }> = getPage.all({ obsoleteId, pageSize: PAGE_SIZE, offset });

      for (const { rowid, sendStateJson, editHistoryJson } of parts) {
        const editHistory = JSON.parse(editHistoryJson || '[]') as Array<{
          sendStateByConversationId?: Record<string, unknown>;
        }>;
        const sendState = JSON.parse(sendStateJson || '{}');
        const patch = {
          conversationId: currentId,
          sendStateByConversationId: {
            [obsoleteId]: null,
            [currentId]: sendState[obsoleteId],
          },

          // Unlike above here we have to provide the full object with all
          // existing properties because arrays can't be patched and can only
          // be replaced.
          editHistory: editHistory.map(
            ({ sendStateByConversationId, ...rest }) => {
              const existingState = sendStateByConversationId?.[obsoleteId];
              if (!existingState) {
                return rest;
              }

              return {
                ...rest,
                sendStateByConversationId: {
                  ...sendStateByConversationId,
                  [obsoleteId]: undefined,
                  [currentId]: existingState,
                },
              };
            }
          ),
        };

        updateOne.run({
          rowid,
          patch: JSON.stringify(patch),
          currentId,
        });
      }

      if (parts.length < PAGE_SIZE) {
        break;
      }
    }
  })();
}

function getMessagesBySentAt(
  db: ReadableDB,
  sentAt: number
): Array<MessageType> {
  return db.transaction(() => {
    // Make sure to preserve order of columns
    const editedColumns = MESSAGE_COLUMNS_FRAGMENTS.map(name => {
      if (name.fragment === 'received_at' || name.fragment === 'sent_at') {
        return name;
      }
      return sqlFragment`messages.${name}`;
    });

    const [query, params] = sql`
      SELECT ${sqlJoin(editedColumns)}
      FROM edited_messages
      INNER JOIN messages ON
        messages.id = edited_messages.messageId
      WHERE edited_messages.sentAt = ${sentAt}
      UNION
      SELECT ${sqlJoin(MESSAGE_COLUMNS_FRAGMENTS)}
      FROM messages
      WHERE sent_at = ${sentAt}
      ORDER BY messages.received_at DESC, messages.sent_at DESC;
    `;

    const rows = db.prepare(query).all<MessageTypeUnhydrated>(params);

    return hydrateMessages(db, rows);
  })();
}

function getExpiredMessages(db: ReadableDB): Array<MessageType> {
  return db.transaction(() => {
    const now = Date.now();

    const rows: Array<MessageTypeUnhydrated> = db
      .prepare(
        `
      SELECT ${MESSAGE_COLUMNS.join(', ')}, expiresAt
      FROM messages
      WHERE
        expiresAt <= $now
      ORDER BY expiresAt ASC;
      `
      )
      .all({ now });

    return hydrateMessages(db, rows);
  })();
}

function getMessagesUnexpectedlyMissingExpirationStartTimestamp(
  db: ReadableDB
): Array<MessageType> {
  return db.transaction(() => {
    const rows: Array<MessageTypeUnhydrated> = db
      .prepare(
        `
      SELECT ${MESSAGE_COLUMNS.join(', ')} FROM messages
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

    return hydrateMessages(db, rows);
  })();
}

function getSoonestMessageExpiry(db: ReadableDB): undefined | number {
  // Note: we use `pluck` to only get the first column.
  const result = db
    .prepare(
      `
      SELECT MIN(expiresAt)
      FROM messages;
      `,
      {
        pluck: true,
      }
    )
    .get<number | null>();

  if (result != null && result >= Number.MAX_SAFE_INTEGER) {
    return undefined;
  }

  return result || undefined;
}

function getNextTapToViewMessageTimestampToAgeOut(
  db: ReadableDB
): undefined | number {
  return db.transaction(() => {
    const row = db
      .prepare(
        `
      SELECT ${MESSAGE_COLUMNS.join(', ')} FROM messages
      WHERE
        -- we want this query to use the messages_view_once index rather than received_at
        likelihood(isViewOnce = 1, 0.01)
        AND (isErased IS NULL OR isErased != 1)
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
      `
      )
      .get<MessageTypeUnhydrated>();

    if (!row) {
      return undefined;
    }
    const data = hydrateMessage(db, row);
    const result = data.received_at_ms;
    return isNormalNumber(result) ? result : undefined;
  })();
}

function getTapToViewMessagesNeedingErase(
  db: ReadableDB,
  maxTimestamp: number
): Array<MessageType> {
  return db.transaction(() => {
    const rows: Array<MessageTypeUnhydrated> = db
      .prepare(
        `
      SELECT ${MESSAGE_COLUMNS.join(', ')}
      FROM messages
      WHERE
        isViewOnce = 1
        AND (isErased IS NULL OR isErased != 1)
        AND (
          IFNULL(received_at_ms, 0) <= $maxTimestamp
        )
      `
      )
      .all({
        maxTimestamp,
      });

    return hydrateMessages(db, rows);
  })();
}

const MAX_UNPROCESSED_ATTEMPTS = 10;

function saveUnprocessed(db: WritableDB, data: UnprocessedType): string {
  const {
    id,
    timestamp,
    receivedAtDate,
    receivedAtCounter,
    attempts,
    type,
    isEncrypted,
    content,

    messageAgeSec,
    source,
    sourceServiceId,
    sourceDevice,
    destinationServiceId,
    updatedPni,
    serverGuid,
    serverTimestamp,
    urgent,
    story,
    reportingToken,
    groupId,
  } = data;
  if (!id) {
    throw new Error('saveUnprocessed: id was falsey');
  }

  db.prepare(
    `
    INSERT OR REPLACE INTO unprocessed (
      id,
      timestamp,
      receivedAtCounter,
      receivedAtDate,
      attempts,
      type,
      isEncrypted,
      content,

      messageAgeSec,
      source,
      sourceServiceId,
      sourceDevice,
      destinationServiceId,
      updatedPni,
      serverGuid,
      serverTimestamp,
      urgent,
      story,
      reportingToken,
      groupId
    ) values (
      $id,
      $timestamp,
      $receivedAtCounter,
      $receivedAtDate,
      $attempts,
      $type,
      $isEncrypted,
      $content,

      $messageAgeSec,
      $source,
      $sourceServiceId,
      $sourceDevice,
      $destinationServiceId,
      $updatedPni,
      $serverGuid,
      $serverTimestamp,
      $urgent,
      $story,
      $reportingToken,
      $groupId
    );
    `
  ).run({
    id,
    timestamp,
    receivedAtCounter,
    receivedAtDate,
    attempts,
    type,
    isEncrypted: isEncrypted ? 1 : 0,
    content,

    messageAgeSec,
    source: source || null,
    sourceServiceId: sourceServiceId || null,
    sourceDevice: sourceDevice || null,
    destinationServiceId,
    updatedPni: updatedPni || null,
    serverGuid,
    serverTimestamp,
    urgent: urgent || !isBoolean(urgent) ? 1 : 0,
    story: story ? 1 : 0,
    reportingToken: reportingToken || null,
    groupId: groupId || null,
  });

  return id;
}

function getUnprocessedCount(db: ReadableDB): number {
  return getCountFromTable(db, 'unprocessed');
}

function getAllUnprocessedIds(db: WritableDB): Array<string> {
  return db.transaction(() => {
    // cleanup first
    const { changes: deletedStaleCount } = db
      .prepare(
        'DELETE FROM unprocessed WHERE receivedAtDate < $messageQueueCutoff'
      )
      .run({
        messageQueueCutoff: Date.now() - 45 * durations.DAY,
      });

    if (deletedStaleCount !== 0) {
      logger.warn(
        'getAllUnprocessedAndIncrementAttempts: ' +
          `deleting ${deletedStaleCount} old unprocessed envelopes`
      );
    }

    const { changes: deletedInvalidCount } = db
      .prepare(
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
      .prepare(
        `
      SELECT id
      FROM unprocessed
      ORDER BY receivedAtCounter ASC
    `,
        {
          pluck: true,
        }
      )
      .all<string>();
  })();
}

function getUnprocessedByIdsAndIncrementAttempts(
  db: WritableDB,
  ids: ReadonlyArray<string>
): Array<UnprocessedType> {
  logger.info('getUnprocessedByIdsAndIncrementAttempts', {
    totalIds: ids.length,
  });

  batchMultiVarQuery(db, ids, (batch, persistent) => {
    return db
      .prepare(
        `
          UPDATE unprocessed
          SET attempts = attempts + 1
          WHERE id IN (${batch.map(() => '?').join(', ')})
        `,
        { persistent }
      )
      .run(batch);
  });

  return batchMultiVarQuery(db, ids, (batch, persistent) => {
    return db
      .prepare(
        `
          SELECT *
          FROM unprocessed
          WHERE id IN (${batch.map(() => '?').join(', ')})
          ORDER BY receivedAtCounter ASC;
        `,
        { persistent }
      )
      .all(batch)
      .map(row => ({
        ...row,
        urgent: isNumber(row.urgent) ? Boolean(row.urgent) : true,
        story: Boolean(row.story),
        isEncrypted: Boolean(row.isEncrypted),
      }));
  });
}

function removeUnprocesseds(
  db: WritableDB,
  ids: ReadonlyArray<string>,
  persistent: boolean
): void {
  db.prepare(
    `
    DELETE FROM unprocessed
    WHERE id IN ( ${ids.map(() => '?').join(', ')} );
    `,
    { persistent }
  ).run(ids);
}

function removeUnprocessed(db: WritableDB, id: string | Array<string>): void {
  if (!Array.isArray(id)) {
    db.prepare('DELETE FROM unprocessed WHERE id = $id;').run({ id });

    return;
  }

  // This can happen normally due to flushing of `cacheRemoveBatcher` in
  // MessageReceiver.
  if (!id.length) {
    return;
  }

  batchMultiVarQuery(db, id, (batch, persistent) =>
    removeUnprocesseds(db, batch, persistent)
  );
}

function removeAllUnprocessed(db: WritableDB): void {
  db.prepare('DELETE FROM unprocessed;').run();
}

// Attachment Downloads

function _getAttachmentDownloadJob(
  db: ReadableDB,
  job: Pick<
    AttachmentDownloadJobType,
    'messageId' | 'attachmentType' | 'attachmentSignature'
  >
): AttachmentDownloadJobType | undefined {
  const [query, params] = sql`
    SELECT * FROM attachment_downloads
    WHERE
      messageId = ${job.messageId}
    AND
      attachmentType = ${job.attachmentType}
    AND
      attachmentSignature = ${job.attachmentSignature};
  `;

  const row = db.prepare(query).get<AttachmentDownloadJobRow>(params);
  if (row === undefined) {
    return undefined;
  }
  const { attachmentJson, ...fields } = row;
  return parseUnknown(attachmentDownloadJobSchema, {
    ...fields,
    active: Boolean(row.active),
    attachment: JSON.parse(attachmentJson),
    ciphertextSize: row.ciphertextSize || 0,
  } as unknown);
}

function removeAllBackupAttachmentDownloadJobs(db: WritableDB): void {
  const [query, params] = sql`
    DELETE FROM attachment_downloads
    WHERE
      source = ${AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA}
    OR
      source = ${AttachmentDownloadSource.BACKUP_IMPORT_NO_MEDIA};`;
  db.prepare(query).run(params);
}

function resetBackupAttachmentDownloadStats(db: WritableDB): void {
  const [query, params] = sql`
    INSERT OR REPLACE INTO attachment_downloads_backup_stats
      (id, totalBytes, completedBytes)
    VALUES
      (0,0,0);
  `;
  db.prepare(query).run(params);
}

function getBackupAttachmentDownloadProgress(
  db: ReadableDB
): BackupAttachmentDownloadProgress {
  const [query, params] = sql`
    SELECT totalBytes, completedBytes FROM attachment_downloads_backup_stats
    WHERE id = 0;
  `;
  return (
    db.prepare(query).get<BackupAttachmentDownloadProgress>(params) ?? {
      totalBytes: 0,
      completedBytes: 0,
    }
  );
}

function getNextAttachmentDownloadJobs(
  db: WritableDB,
  {
    limit = 3,
    sources,
    prioritizeMessageIds,
    timestamp = Date.now(),
    maxLastAttemptForPrioritizedMessages,
  }: {
    limit: number;
    prioritizeMessageIds?: Array<string>;
    sources?: Array<AttachmentDownloadSource>;
    timestamp?: number;
    maxLastAttemptForPrioritizedMessages?: number;
  }
): Array<AttachmentDownloadJobType> {
  let priorityJobs = new Array<AttachmentDownloadJobRow>();

  const sourceWhereFragment = sources
    ? sqlFragment`
      source IN (${sqlJoin(sources)})
    `
    : sqlFragment`
      TRUE
    `;

  // First, try to get jobs for prioritized messages (e.g. those currently user-visible)
  if (prioritizeMessageIds?.length) {
    const [priorityQuery, priorityParams] = sql`
      SELECT * FROM attachment_downloads
      -- very few rows will match messageIds, so in this case we want to optimize
      -- the WHERE clause rather than the ORDER BY
      INDEXED BY attachment_downloads_active_messageId
      WHERE
        active = 0
      AND
        -- for priority messages, we want to retry based on the last attempt, rather than retryAfter
        (lastAttemptTimestamp is NULL OR lastAttemptTimestamp <= ${
          maxLastAttemptForPrioritizedMessages ?? timestamp - durations.HOUR
        })
      AND
        messageId IN (${sqlJoin(prioritizeMessageIds)})
      AND
        ${sourceWhereFragment}
      -- for priority messages, let's load them oldest first; this helps, e.g. for stories where we
      -- want the oldest one first
      ORDER BY receivedAt ASC
      LIMIT ${limit}
    `;
    priorityJobs = db.prepare(priorityQuery).all(priorityParams);
  }

  // Next, get any other jobs, sorted by receivedAt
  const numJobsRemaining = limit - priorityJobs.length;
  let standardJobs: typeof priorityJobs = [];
  if (numJobsRemaining > 0) {
    const [query, params] = sql`
      SELECT * FROM attachment_downloads
      WHERE
        active = 0
      AND
        (retryAfter is NULL OR retryAfter <= ${timestamp})
      AND
        ${sourceWhereFragment}
      ORDER BY receivedAt DESC
      LIMIT ${numJobsRemaining}
    `;

    standardJobs = db.prepare(query).all(params);
  }

  const allJobs = priorityJobs.concat(standardJobs);
  const INNER_ERROR = 'jsonToObject or SchemaParse error';
  try {
    return allJobs.map(row => {
      try {
        return parseUnknown(attachmentDownloadJobSchema, {
          ...row,
          active: Boolean(row.active),
          attachment: jsonToObject(row.attachmentJson),
        } as unknown);
      } catch (error) {
        logger.error(
          `getNextAttachmentDownloadJobs: Error with job for message ${row.messageId}, deleting.`
        );

        removeAttachmentDownloadJob(db, row);
        throw new Error(error);
      }
    });
  } catch (error) {
    if ('message' in error && error.message === INNER_ERROR) {
      return getNextAttachmentDownloadJobs(db, {
        limit,
        prioritizeMessageIds,
        timestamp,
        maxLastAttemptForPrioritizedMessages,
      });
    }
    throw error;
  }
}

function saveAttachmentDownloadJobs(
  db: WritableDB,
  jobs: Array<AttachmentDownloadJobType>
): void {
  const errors: Array<Error> = [];
  db.transaction(() => {
    for (const job of jobs) {
      try {
        saveAttachmentDownloadJob(db, job);
      } catch (e) {
        errors.push(e);
      }
    }
  })();

  if (errors.length === 0) {
    return;
  }
  if (errors.length === 1) {
    throw errors[0];
  }
  throw new AggregateError(
    errors,
    `Multiple errors while saving attachment download jobs:\n ${errors.map(e => e.message).join('\n')}`
  );
}

function saveAttachmentDownloadJob(
  db: WritableDB,
  job: AttachmentDownloadJobType
): void {
  return db.transaction(() => {
    const [messageExistsQuery, messageExistsParams] = sql`
      SELECT EXISTS(
        SELECT 1 FROM messages
        WHERE messages.id = ${job.messageId}
      );
    `;

    const messageExists = db
      .prepare(messageExistsQuery, {
        pluck: true,
      })
      .get<number>(messageExistsParams);

    if (messageExists !== 1) {
      logger.warn('saveAttachmentDownloadJob: message does not exist, bailing');
      return;
    }
    const jobToInsert: AttachmentDownloadJobRow = {
      messageId: job.messageId,
      attachmentType: job.attachmentType,
      attachmentSignature: job.attachmentSignature,
      receivedAt: job.receivedAt,
      sentAt: job.sentAt,
      contentType: job.contentType,
      size: job.size,
      active: job.active ? 1 : 0,
      attempts: job.attempts,
      retryAfter: job.retryAfter,
      lastAttemptTimestamp: job.lastAttemptTimestamp,
      attachmentJson: objectToJSON(job.attachment),
      ciphertextSize: job.ciphertextSize,
      originalSource: job.originalSource,
      source: job.source,
    } as const satisfies Record<
      (typeof ATTACHMENT_DOWNLOADS_COLUMNS)[number],
      unknown
    >;

    db.prepare(
      `
      INSERT INTO attachment_downloads
        (${ATTACHMENT_DOWNLOADS_COLUMNS.join(', ')})
      VALUES
        (${ATTACHMENT_DOWNLOADS_COLUMNS.map(name => `$${name}`).join(', ')})
      ON CONFLICT DO UPDATE SET
          -- preserve originalSource
          ${ATTACHMENT_DOWNLOADS_COLUMNS.filter(
            name => name !== 'originalSource'
          )
            .map(name => `${name} = $${name}`)
            .join(', ')}
    `
    ).run(jobToInsert);
  })();
}

function resetAttachmentDownloadActive(db: WritableDB): void {
  db.prepare(
    `
    UPDATE attachment_downloads
    SET active = 0
    WHERE active != 0;
    `
  ).run();
}

function resetBackupAttachmentDownloadJobsRetryAfter(db: WritableDB): void {
  db.prepare(
    `
    UPDATE attachment_downloads
    SET retryAfter = NULL
    WHERE originalSource = 'backup_import'
    `
  ).run();
}

function removeAttachmentDownloadJob(
  db: WritableDB,
  job: Pick<
    AttachmentDownloadJobRow,
    'messageId' | 'attachmentType' | 'attachmentSignature'
  >
): void {
  const [query, params] = sql`
    DELETE FROM attachment_downloads
    WHERE
      messageId = ${job.messageId}
    AND
      attachmentType = ${job.attachmentType}
    AND
      attachmentSignature = ${job.attachmentSignature};
  `;

  db.prepare(query).run(params);
}

function removeAttachmentDownloadJobsForMessage(
  db: WritableDB,
  messageId: string
): void {
  const [query, params] = sql`
    DELETE FROM attachment_downloads
    WHERE messageId = ${messageId}
  `;

  db.prepare(query).run(params);
}

// Backup Attachments

function clearAllAttachmentBackupJobs(db: WritableDB): void {
  db.prepare('DELETE FROM attachment_backup_jobs;').run();
}

function markAllAttachmentBackupJobsInactive(db: WritableDB): void {
  db.prepare(
    `
    UPDATE attachment_backup_jobs
    SET active = 0;
    `
  ).run();
}

function saveAttachmentBackupJob(
  db: WritableDB,
  job: AttachmentBackupJobType
): void {
  const [query, params] = sql`
    INSERT OR REPLACE INTO attachment_backup_jobs (
      active,
      attempts,
      data,
      lastAttemptTimestamp,
      mediaName,
      receivedAt,
      retryAfter,
      type
    ) VALUES (
      ${job.active ? 1 : 0},
      ${job.attempts},
      ${objectToJSON(job.data)},
      ${job.lastAttemptTimestamp},
      ${job.mediaName},
      ${job.receivedAt},
      ${job.retryAfter},
      ${job.type}
    );
  `;
  db.prepare(query).run(params);
}

function getNextAttachmentBackupJobs(
  db: WritableDB,
  {
    limit,
    timestamp = Date.now(),
  }: {
    limit: number;
    timestamp?: number;
  }
): Array<AttachmentBackupJobType> {
  const [query, params] = sql`
    SELECT * FROM attachment_backup_jobs
    WHERE
      active = 0
    AND
      (retryAfter is NULL OR retryAfter <= ${timestamp})
    ORDER BY
      -- type is "standard" or "thumbnail"; we prefer "standard" jobs
      type ASC, receivedAt DESC
    LIMIT ${limit}
  `;
  const rows = db.prepare(query).all<{
    mediaName: string;
    data: string;
    active: number;
  }>(params);
  return rows
    .map(row => {
      const parseResult = safeParseUnknown(attachmentBackupJobSchema, {
        ...row,
        active: Boolean(row.active),
        data: jsonToObject(row.data),
      } as unknown);
      if (!parseResult.success) {
        const redactedMediaName = redactGenericText(row.mediaName);
        logger.error(
          `getNextAttachmentBackupJobs: invalid data, removing. mediaName: ${redactedMediaName}`,
          Errors.toLogFormat(parseResult.error)
        );
        removeAttachmentBackupJob(db, { mediaName: row.mediaName });
        return null;
      }
      return parseResult.data;
    })
    .filter(isNotNil);
}

function removeAttachmentBackupJob(
  db: WritableDB,
  job: Pick<AttachmentBackupJobType, 'mediaName'>
): void {
  const [query, params] = sql`
    DELETE FROM attachment_backup_jobs
    WHERE
      mediaName = ${job.mediaName};
  `;

  db.prepare(query).run(params);
}

// Attachments on backup CDN
function clearAllBackupCdnObjectMetadata(db: WritableDB): void {
  db.prepare('DELETE FROM backup_cdn_object_metadata;').run();
}

function saveBackupCdnObjectMetadata(
  db: WritableDB,
  storedMediaObjects: Array<BackupCdnMediaObjectType>
): void {
  db.transaction(() => {
    for (const obj of storedMediaObjects) {
      const { mediaId, cdnNumber, sizeOnBackupCdn } = obj;
      const [query, params] = sql`
        INSERT OR REPLACE INTO backup_cdn_object_metadata
        (
          mediaId,
          cdnNumber,
          sizeOnBackupCdn
        ) VALUES (
          ${mediaId},
          ${cdnNumber},
          ${sizeOnBackupCdn}
        );
      `;

      db.prepare(query).run(params);
    }
  })();
}

function getBackupCdnObjectMetadata(
  db: ReadableDB,
  mediaId: string
): BackupCdnMediaObjectType | undefined {
  const [query, params] = sql`
    SELECT * FROM backup_cdn_object_metadata
    WHERE mediaId = ${mediaId}
  `;

  return db.prepare(query).get(params);
}

// Stickers

function createOrUpdateStickerPack(
  db: WritableDB,
  pack: StickerPackType
): void {
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

  const row = db
    .prepare(
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
  };

  if (row) {
    db.prepare(
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

  let { position } = pack;

  // Assign default position when inserting a row
  if (!isNumber(position)) {
    position = db
      .prepare(
        `
    SELECT IFNULL(MAX(position) + 1, 0)
    FROM sticker_packs
    `,
        {
          pluck: true,
        }
      )
      .get();
  }

  db.prepare(
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
      position
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
      $position
    )
    `
  ).run({ ...payload, position: position ?? 0 });
}
function createOrUpdateStickerPacks(
  db: WritableDB,
  packs: ReadonlyArray<StickerPackType>
): void {
  db.transaction(() => {
    for (const pack of packs) {
      createOrUpdateStickerPack(db, pack);
    }
  })();
}
function updateStickerPackStatus(
  db: WritableDB,
  id: string,
  status: StickerPackStatusType,
  options?: { timestamp: number }
): StickerPackStatusType | null {
  const timestamp = options ? options.timestamp || Date.now() : Date.now();
  const installedAt = status === 'installed' ? timestamp : null;

  return db.transaction(() => {
    const [select, selectParams] = sql`
      SELECT status FROM sticker_packs WHERE id IS ${id};
    `;

    const oldStatus =
      db
        .prepare(select, {
          pluck: true,
        })
        .get<StickerPackRow['status']>(selectParams) ?? null;

    const [update, updateParams] = sql`
      UPDATE sticker_packs
      SET status = ${status}, installedAt = ${installedAt}
      WHERE id IS ${id}
    `;

    db.prepare(update).run(updateParams);

    return oldStatus;
  })();
}
function updateStickerPackInfo(
  db: WritableDB,
  {
    id,
    storageID,
    storageVersion,
    storageUnknownFields,
    storageNeedsSync,
    uninstalledAt,
    position,
  }: StickerPackInfoType
): void {
  if (uninstalledAt) {
    db.prepare(
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
    db.prepare(
      `
      UPDATE sticker_packs
      SET
        storageID = $storageID,
        storageVersion = $storageVersion,
        storageUnknownFields = $storageUnknownFields,
        storageNeedsSync = $storageNeedsSync,
        position = $position
      WHERE id = $id;
      `
    ).run({
      id,
      storageID: storageID ?? null,
      storageVersion: storageVersion ?? null,
      storageUnknownFields: storageUnknownFields ?? null,
      storageNeedsSync: storageNeedsSync ? 1 : 0,
      position: position || 0,
    });
  }
}
function clearAllErrorStickerPackAttempts(db: WritableDB): void {
  db.prepare(
    `
    UPDATE sticker_packs
    SET downloadAttempts = 0
    WHERE status = 'error';
    `
  ).run();
}
function createOrUpdateSticker(db: WritableDB, sticker: StickerType): void {
  const {
    emoji,
    height,
    id,
    isCoverOnly,
    lastUsed,
    packId,
    path,
    width,
    version,
    localKey,
    size,
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

  db.prepare(
    `
    INSERT OR REPLACE INTO stickers (
      emoji,
      height,
      id,
      isCoverOnly,
      lastUsed,
      packId,
      path,
      width,
      version,
      localKey,
      size
    ) values (
      $emoji,
      $height,
      $id,
      $isCoverOnly,
      $lastUsed,
      $packId,
      $path,
      $width,
      $version,
      $localKey,
      $size
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
    version: version || 1,
    localKey: localKey || null,
    size: size || null,
  });
}
function createOrUpdateStickers(
  db: WritableDB,
  stickers: ReadonlyArray<StickerType>
): void {
  db.transaction(() => {
    for (const sticker of stickers) {
      createOrUpdateSticker(db, sticker);
    }
  })();
}
function updateStickerLastUsed(
  db: WritableDB,
  packId: string,
  stickerId: number,
  lastUsed: number
): void {
  db.prepare(
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
  db.prepare(
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
function addStickerPackReference(
  db: WritableDB,
  { messageId, packId, stickerId, isUnresolved }: StickerPackRefType
): void {
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

  db.transaction(() => {
    const [select, selectParams] = sql`
      SELECT EXISTS (
        SELECT 1 FROM sticker_packs WHERE id IS ${packId}
      )
    `;
    const exists =
      db.prepare(select, { pluck: true }).get<number>(selectParams) === 1;
    if (!exists) {
      logger.warn('addStickerPackReference: did not find referenced pack');
      return;
    }

    const [insert, insertParams] = sql`
      INSERT OR REPLACE INTO sticker_references (
        messageId,
        packId,
        stickerId,
        isUnresolved
      ) values (
        ${messageId},
        ${packId},
        ${stickerId},
        ${isUnresolved ? 1 : 0}
      )
    `;

    db.prepare(insert).run(insertParams);
  })();
}
function deleteStickerPackReference(
  db: WritableDB,
  { messageId, packId }: Pick<StickerPackRefType, 'messageId' | 'packId'>
): ReadonlyArray<string> | undefined {
  return db.transaction(() => {
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
    db.prepare(
      `
        DELETE FROM sticker_references
        WHERE messageId = $messageId AND packId = $packId;
        `
    ).run({
      messageId,
      packId,
    });

    const count =
      db
        .prepare(
          `
      SELECT count(1) FROM sticker_references
      WHERE packId = $packId;
      `,
          {
            pluck: true,
          }
        )
        .get<number>({ packId }) ?? 0;
    if (count > 0) {
      return undefined;
    }

    const packRow = db
      .prepare(
        `
          SELECT status FROM sticker_packs
          WHERE id = $packId;
          `
      )
      .get<{ status: StickerPackStatusType }>({ packId });
    if (!packRow) {
      logger.warn('deleteStickerPackReference: did not find referenced pack');
      return undefined;
    }
    const { status } = packRow;

    if (status === 'installed') {
      return undefined;
    }

    const stickerPathRows: Array<{ path: string }> = db
      .prepare(
        `
          SELECT path FROM stickers
          WHERE packId = $packId;
          `
      )
      .all({
        packId,
      });
    db.prepare(
      `
        DELETE FROM sticker_packs
        WHERE id = $packId;
        `
    ).run({
      packId,
    });

    return (stickerPathRows || []).map(row => row.path);
  })();
}
function getUnresolvedStickerPackReferences(
  db: WritableDB,
  packId: string
): Array<StickerPackRefType> {
  return db.transaction(() => {
    const [query, params] = sql`
      UPDATE sticker_references
      SET isUnresolved = 0
      WHERE packId IS ${packId} AND isUnresolved IS 1
      RETURNING messageId, stickerId;
    `;
    const rows = db
      .prepare(query)
      .all<{ messageId: string; stickerId: number }>(params);

    return rows.map(({ messageId, stickerId }) => ({
      messageId,
      packId,
      stickerId,
      isUnresolved: true,
    }));
  })();
}

function deleteStickerPack(db: WritableDB, packId: string): Array<string> {
  if (!packId) {
    throw new Error(
      'deleteStickerPack: Provided data did not have a truthy packId'
    );
  }

  return db.transaction(() => {
    // We use an immediate transaction here to immediately acquire an exclusive lock,
    //   which would normally only happen when we did our first write.

    // We need this to ensure that our two queries are atomic, with no other changes
    //   happening while we do it:
    // 1. Grab all of target pack's sticker paths
    // 2. Delete sticker pack (which cascades to all stickers and references)

    const stickerPathRows: Array<{ path: string }> = db
      .prepare(
        `
          SELECT path FROM stickers
          WHERE packId = $packId;
          `
      )
      .all({
        packId,
      });
    db.prepare(
      `
        DELETE FROM sticker_packs
        WHERE id = $packId;
        `
    ).run({ packId });

    return (stickerPathRows || []).map(row => row.path);
  })();
}

function getStickerCount(db: ReadableDB): number {
  return getCountFromTable(db, 'stickers');
}
function getAllStickerPacks(db: ReadableDB): Array<StickerPackType> {
  const rows = db
    .prepare(
      `
      SELECT * FROM sticker_packs
      ORDER BY position ASC, id ASC
      `
    )
    .all<StickerPackRow>();

  return rows.map(row => {
    return {
      ...row,
      storageNeedsSync: row.storageNeedsSync === 1,
      stickers: {},

      // The columns have STRING type so if they have numeric value, sqlite
      // will return integers.
      author: String(row.author),
      title: String(row.title),
    };
  });
}
function addUninstalledStickerPack(
  db: WritableDB,
  pack: UninstalledStickerPackType
): void {
  db.prepare(
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
function addUninstalledStickerPacks(
  db: WritableDB,
  packs: ReadonlyArray<UninstalledStickerPackType>
): void {
  return db.transaction(() => {
    for (const pack of packs) {
      addUninstalledStickerPack(db, pack);
    }
  })();
}
function removeUninstalledStickerPack(db: WritableDB, packId: string): void {
  const [query, params] = sql`
    DELETE FROM uninstalled_sticker_packs WHERE id IS ${packId}
  `;
  db.prepare(query).run(params);
}
function getUninstalledStickerPacks(
  db: ReadableDB
): Array<UninstalledStickerPackType> {
  const rows = db
    .prepare('SELECT * FROM uninstalled_sticker_packs ORDER BY id ASC')
    .all<UninstalledStickerPackRow>();

  return rows.map(row => ({
    ...row,
    storageNeedsSync: row.storageNeedsSync === 1,
  }));
}
function getInstalledStickerPacks(db: ReadableDB): Array<StickerPackType> {
  // If sticker pack has a storageID - it is being downloaded and about to be
  // installed so we better sync it back to storage service if asked.
  const rows = db
    .prepare(
      `
      SELECT *
      FROM sticker_packs
      WHERE
        status IS 'installed' OR
        storageID IS NOT NULL
      ORDER BY id ASC
      `
    )
    .all<StickerPackRow>();

  return rows.map(row => ({
    ...row,
    storageNeedsSync: row.storageNeedsSync === 1,
    stickers: {},
  }));
}
function getStickerPackInfo(
  db: ReadableDB,
  packId: string
): StickerPackInfoType | undefined {
  return db.transaction(() => {
    const uninstalled = db
      .prepare(
        `
        SELECT * FROM uninstalled_sticker_packs
        WHERE id IS $packId
        `
      )
      .get<UninstalledStickerPackRow>({ packId });
    if (uninstalled) {
      return {
        ...uninstalled,
        storageNeedsSync: uninstalled.storageNeedsSync === 1,
        key: undefined,
        position: undefined,
      };
    }

    const installed = db
      .prepare(
        `
        SELECT
          id, key, position, storageID, storageVersion, storageUnknownFields
        FROM sticker_packs
        WHERE id IS $packId
        `
      )
      .get<InstalledStickerPackRow>({ packId });
    if (installed) {
      return {
        ...installed,
        storageNeedsSync: installed.storageNeedsSync === 1,
        uninstalledAt: undefined,
      };
    }

    return undefined;
  })();
}
function installStickerPack(
  db: WritableDB,
  packId: string,
  timestamp: number
): boolean {
  return db.transaction(() => {
    const status = 'installed';
    removeUninstalledStickerPack(db, packId);
    const oldStatus = updateStickerPackStatus(db, packId, status, {
      timestamp,
    });

    const wasPreviouslyUninstalled = oldStatus !== 'installed';

    if (wasPreviouslyUninstalled) {
      const [query, params] = sql`
        UPDATE sticker_packs SET
          storageNeedsSync = 1
        WHERE id IS ${packId};
      `;
      db.prepare(query).run(params);
    }

    return wasPreviouslyUninstalled;
  })();
}
function uninstallStickerPack(
  db: WritableDB,
  packId: string,
  timestamp: number
): boolean {
  return db.transaction(() => {
    const status = 'downloaded';
    const oldStatus = updateStickerPackStatus(db, packId, status);

    const wasPreviouslyInstalled = oldStatus === 'installed';

    const [query, params] = sql`
      UPDATE sticker_packs SET
        storageID = NULL,
        storageVersion = NULL,
        storageUnknownFields = NULL,
        storageNeedsSync = 0
      WHERE id = ${packId}
    `;

    db.prepare(query).run(params);

    addUninstalledStickerPack(db, {
      id: packId,
      uninstalledAt: timestamp,
      storageNeedsSync: wasPreviouslyInstalled,
    });

    return wasPreviouslyInstalled;
  })();
}
function getAllStickers(db: ReadableDB): Array<StickerType> {
  const rows = db
    .prepare(
      `
      SELECT * FROM stickers
      ORDER BY packId ASC, id ASC
      `
    )
    .all<StickerRow>();

  return (rows || []).map(row => rowToSticker(row));
}
function getRecentStickers(
  db: ReadableDB,
  { limit }: { limit?: number } = {}
): Array<StickerType> {
  // Note: we avoid 'IS NOT NULL' here because it does seem to bypass our index
  const rows = db
    .prepare(
      `
      SELECT stickers.* FROM stickers
      JOIN sticker_packs on stickers.packId = sticker_packs.id
      WHERE stickers.lastUsed > 0 AND sticker_packs.status = 'installed'
      ORDER BY stickers.lastUsed DESC
      LIMIT $limit
      `
    )
    .all<StickerRow>({
      limit: limit || 24,
    });

  return (rows || []).map(row => rowToSticker(row));
}

// Emojis
function updateEmojiUsage(
  db: WritableDB,
  shortName: string,
  timeUsed: number = Date.now()
): void {
  db.transaction(() => {
    const rows = db
      .prepare(
        `
        SELECT * FROM emojis
        WHERE shortName = $shortName;
        `
      )
      .get({
        shortName,
      });

    if (rows) {
      db.prepare(
        `
        UPDATE emojis
        SET lastUsage = $timeUsed
        WHERE shortName = $shortName;
        `
      ).run({ shortName, timeUsed });
    } else {
      db.prepare(
        `
        INSERT INTO emojis(shortName, lastUsage)
        VALUES ($shortName, $timeUsed);
        `
      ).run({ shortName, timeUsed });
    }
  })();
}

function getRecentEmojis(db: ReadableDB, limit = 32): Array<EmojiType> {
  const rows = db
    .prepare(
      `
      SELECT *
      FROM emojis
      ORDER BY lastUsage DESC
      LIMIT $limit;
      `
    )
    .all<EmojiType>({ limit });

  return rows || [];
}

const RecentGifsRow = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  previewMedia_url: z.string(),
  previewMedia_width: z.number().int(),
  previewMedia_height: z.number().int(),
  attachmentMedia_url: z.string(),
  attachmentMedia_width: z.number().int(),
  attachmentMedia_height: z.number().int(),
  lastUsedAt: z.number().int(),
});

function getRecentGifs(db: ReadableDB, limit: number): ReadonlyArray<GifType> {
  const [query, params] = sql`
    SELECT * FROM recentGifs
    ORDER BY lastUsedAt DESC
    LIMIT ${limit}
  `;
  return db
    .prepare(query)
    .all(params)
    .map((raw: unknown) => {
      const row = parseUnknown(RecentGifsRow, raw);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        previewMedia: {
          url: row.previewMedia_url,
          width: row.previewMedia_width,
          height: row.previewMedia_height,
        },
        attachmentMedia: {
          url: row.attachmentMedia_url,
          width: row.attachmentMedia_width,
          height: row.attachmentMedia_height,
        },
      };
    });
}

function addRecentGif(
  db: WritableDB,
  gif: GifType,
  lastUsedAt: number,
  maxRecents: number
): void {
  const [insertQuery, insertParams] = sql`
    INSERT OR REPLACE INTO recentGifs (
      id,
      title,
      description,
      previewMedia_url,
      previewMedia_width,
      previewMedia_height,
      attachmentMedia_url,
      attachmentMedia_width,
      attachmentMedia_height,
      lastUsedAt
    ) VALUES (
      ${gif.id},
      ${gif.title},
      ${gif.description},
      ${gif.previewMedia.url},
      ${gif.previewMedia.width},
      ${gif.previewMedia.height},
      ${gif.attachmentMedia.url},
      ${gif.attachmentMedia.width},
      ${gif.attachmentMedia.height},
      ${lastUsedAt}
    );
  `;

  const [deleteQuery, deleteParams] = sql`
    DELETE FROM recentGifs
    WHERE id NOT IN (
      SELECT id FROM recentGifs
      ORDER BY lastUsedAt DESC
      LIMIT ${maxRecents}
    );
  `;

  db.transaction(() => {
    db.prepare(insertQuery).run(insertParams);
    db.prepare(deleteQuery).run(deleteParams);
  })();
}

function removeRecentGif(db: WritableDB, gif: Pick<GifType, 'id'>): void {
  const [query, params] = sql`
    DELETE FROM recentGifs
    WHERE id = ${gif.id}
  `;
  db.prepare(query).run(params);
}

function getAllBadges(db: ReadableDB): Array<BadgeType> {
  return db.transaction(() => {
    const badgeRows = db.prepare('SELECT * FROM badges').all<{
      id: string;
      category: string;
      name: string;
      descriptionTemplate: string;
    }>();
    const badgeImageFileRows = db.prepare('SELECT * FROM badgeImageFiles').all<{
      badgeId: string;
      order: number;
      url: string;
      localPath: string;
      theme: BadgeImageTheme;
    }>();

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
  })();
}

// This should match the logic in the badges Redux reducer.
function updateOrCreateBadges(
  db: WritableDB,
  badges: ReadonlyArray<BadgeType>
): void {
  const insertBadge = db.prepare(
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
  const getImageFilesForBadge = db.prepare(
    'SELECT url, localPath FROM badgeImageFiles WHERE badgeId = $badgeId'
  );
  const insertBadgeImageFile = db.prepare(
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
      for (const { url, localPath } of getImageFilesForBadge.all<{
        url: string;
        localPath: string;
      }>({ badgeId })) {
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

function badgeImageFileDownloaded(
  db: WritableDB,
  url: string,
  localPath: string
): void {
  db.prepare(
    'UPDATE badgeImageFiles SET localPath = $localPath WHERE url = $url'
  ).run({ url, localPath });
}

function getAllBadgeImageFileLocalPaths(db: ReadableDB): Set<string> {
  const localPaths = db
    .prepare(
      'SELECT localPath FROM badgeImageFiles WHERE localPath IS NOT NULL',
      {
        pluck: true,
      }
    )
    .all<string>();
  return new Set(localPaths);
}

function runCorruptionChecks(db: WritableDB, isRetrying = false): boolean {
  let ok = true;

  try {
    const result = db.pragma('integrity_check');
    if (result.length === 1 && result.at(0)?.integrity_check === 'ok') {
      logger.info('runCorruptionChecks: general integrity is ok');
    } else {
      logger.error('runCorruptionChecks: general integrity is not ok', result);
      ok = false;
    }
  } catch (error) {
    logger.error(
      'runCorruptionChecks: general integrity check error',
      Errors.toLogFormat(error)
    );
    ok = false;
  }
  try {
    db.exec("INSERT INTO messages_fts(messages_fts) VALUES('integrity-check')");
    logger.info('runCorruptionChecks: FTS5 integrity ok');
  } catch (error) {
    logger.error(
      'runCorruptionChecks: FTS5 integrity check error.',
      Errors.toLogFormat(error)
    );
    ok = false;

    if (!isRetrying) {
      try {
        db.exec("INSERT INTO messages_fts(messages_fts) VALUES('rebuild');");

        logger.info('runCorruptionChecks: FTS5 index rebuilt');
      } catch (rebuildError) {
        logger.error(
          'runCorruptionChecks: FTS5 recovery failed',
          Errors.toLogFormat(rebuildError)
        );
        return false;
      }

      // Successfully recovered, try again.
      logger.info('runCorruptionChecks: retrying');
      return runCorruptionChecks(db, true);
    }
  }

  return ok;
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

function _getAllStoryDistributions(
  db: ReadableDB
): Array<StoryDistributionType> {
  const storyDistributions = db
    .prepare('SELECT * FROM storyDistributions;')
    .all<StoryDistributionForDatabase>();

  return storyDistributions.map(hydrateStoryDistribution);
}
function _getAllStoryDistributionMembers(
  db: ReadableDB
): Array<StoryDistributionMemberType> {
  return db.prepare('SELECT * FROM storyDistributionMembers;').all();
}
function _deleteAllStoryDistributions(db: WritableDB): void {
  db.prepare('DELETE FROM storyDistributions;').run();
}
function createNewStoryDistribution(
  db: WritableDB,
  distribution: StoryDistributionWithMembersType
): void {
  strictAssert(
    distribution.name,
    'Distribution list does not have a valid name'
  );

  db.transaction(() => {
    const payload = freezeStoryDistribution(distribution);

    db.prepare(
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

    const memberInsertStatement = db.prepare(
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
function getAllStoryDistributionsWithMembers(
  db: ReadableDB
): Array<StoryDistributionWithMembersType> {
  const allDistributions = _getAllStoryDistributions(db);
  const allMembers = _getAllStoryDistributionMembers(db);

  const byListId = groupBy(allMembers, member => member.listId);

  return allDistributions.map(list => ({
    ...list,
    members: (byListId[list.id] || []).map(member => member.serviceId),
  }));
}
function getStoryDistributionWithMembers(
  db: ReadableDB,
  id: string
): StoryDistributionWithMembersType | undefined {
  const storyDistribution = db
    .prepare('SELECT * FROM storyDistributions WHERE id = $id;')
    .get<StoryDistributionForDatabase>({
      id,
    });

  if (!storyDistribution) {
    return undefined;
  }

  const members = db
    .prepare(
      'SELECT serviceId FROM storyDistributionMembers WHERE listId = $id;'
    )
    .all<{ serviceId: ServiceIdString }>({
      id,
    });

  return {
    ...hydrateStoryDistribution(storyDistribution),
    members: members.map(({ serviceId }) => serviceId),
  };
}
function modifyStoryDistribution(
  db: WritableDB,
  distribution: StoryDistributionType
): void {
  const payload = freezeStoryDistribution(distribution);

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

  db.prepare(
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
function modifyStoryDistributionMembers(
  db: WritableDB,
  listId: string,
  {
    toAdd,
    toRemove,
  }: { toAdd: Array<ServiceIdString>; toRemove: Array<ServiceIdString> }
): void {
  const memberInsertStatement = db.prepare(
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
    (serviceIds: ReadonlyArray<ServiceIdString>, persistent: boolean) => {
      const serviceIdSet = sqlJoin(serviceIds);
      const [sqlQuery, sqlParams] = sql`
        DELETE FROM storyDistributionMembers
        WHERE listId = ${listId} AND serviceId IN (${serviceIdSet});
      `;
      db.prepare(sqlQuery, { persistent }).run(sqlParams);
    }
  );
}
function modifyStoryDistributionWithMembers(
  db: WritableDB,
  distribution: StoryDistributionType,
  {
    toAdd,
    toRemove,
  }: { toAdd: Array<ServiceIdString>; toRemove: Array<ServiceIdString> }
): void {
  if (toAdd.length || toRemove.length) {
    db.transaction(() => {
      modifyStoryDistribution(db, distribution);
      modifyStoryDistributionMembers(db, distribution.id, { toAdd, toRemove });
    })();
  } else {
    modifyStoryDistribution(db, distribution);
  }
}
function deleteStoryDistribution(
  db: WritableDB,
  id: StoryDistributionIdString
): void {
  db.prepare('DELETE FROM storyDistributions WHERE id = $id;').run({
    id,
  });
}

function _getAllStoryReads(db: ReadableDB): Array<StoryReadType> {
  return db.prepare('SELECT * FROM storyReads;').all();
}
function _deleteAllStoryReads(db: WritableDB): void {
  db.prepare('DELETE FROM storyReads;').run();
}
function addNewStoryRead(db: WritableDB, read: StoryReadType): void {
  db.prepare(
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
function getLastStoryReadsForAuthor(
  db: ReadableDB,
  {
    authorId,
    conversationId,
    limit: initialLimit,
  }: {
    authorId: ServiceIdString;
    conversationId?: string;
    limit?: number;
  }
): Array<StoryReadType> {
  const limit = initialLimit || 5;

  return db
    .prepare(
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

function countStoryReadsByConversation(
  db: ReadableDB,
  conversationId: string
): number {
  return (
    db
      .prepare(
        `
      SELECT count(1) FROM storyReads
      WHERE conversationId = $conversationId;
      `,
        {
          pluck: true,
        }
      )
      .get<number>({ conversationId }) ?? 0
  );
}

type NotificationProfileForDatabase = Readonly<
  {
    emoji: string | null;
    allowAllCalls: 0 | 1;
    allowAllMentions: 0 | 1;
    scheduleEnabled: 0 | 1;
    allowedMembersJson: string | null;
    scheduleStartTime: number | null;
    scheduleEndTime: number | null;
    scheduleDaysEnabledJson: string | null;
    deletedAtTimestampMs: number | null;
    storageID: string | null;
    storageVersion: number | null;
    storageNeedsSync: 0 | 1;
  } & Omit<
    NotificationProfileType,
    | 'emoji'
    | 'allowAllCalls'
    | 'allowAllMentions'
    | 'scheduleEnabled'
    | 'allowedMembers'
    | 'scheduleStartTime'
    | 'scheduleEndTime'
    | 'scheduleDaysEnabled'
    | 'deletedAtTimestampMs'
    | 'storageID'
    | 'storageVersion'
    | 'storageNeedsSync'
  >
>;

function hydrateNotificationProfile(
  profile: NotificationProfileForDatabase
): NotificationProfileType {
  return {
    ...omit(profile, ['allowedMembersJson', 'scheduleDaysEnabledJson']),
    emoji: profile.emoji || undefined,
    allowAllCalls: Boolean(profile.allowAllCalls),
    allowAllMentions: Boolean(profile.allowAllMentions),
    scheduleEnabled: Boolean(profile.scheduleEnabled),
    allowedMembers: profile.allowedMembersJson
      ? new Set<string>(JSON.parse(profile.allowedMembersJson))
      : new Set<string>(),
    scheduleStartTime: profile.scheduleStartTime || undefined,
    scheduleEndTime: profile.scheduleEndTime || undefined,
    scheduleDaysEnabled: profile.scheduleDaysEnabledJson
      ? JSON.parse(profile.scheduleDaysEnabledJson)
      : undefined,
    deletedAtTimestampMs: profile.deletedAtTimestampMs || undefined,
    storageID: profile.storageID || undefined,
    storageVersion: profile.storageVersion || undefined,
    storageNeedsSync: Boolean(profile.storageNeedsSync),
    storageUnknownFields: profile.storageUnknownFields || undefined,
  };
}
function freezeNotificationProfile(
  profile: NotificationProfileType
): NotificationProfileForDatabase {
  return {
    ...omit(profile, ['allowedMembers', 'scheduleDaysEnabled']),
    emoji: profile.emoji || null,
    allowAllCalls: profile.allowAllCalls ? 1 : 0,
    allowAllMentions: profile.allowAllMentions ? 1 : 0,
    scheduleEnabled: profile.scheduleEnabled ? 1 : 0,
    allowedMembersJson: profile.allowedMembers
      ? JSON.stringify(Array.from(profile.allowedMembers))
      : null,
    scheduleStartTime: profile.scheduleStartTime || null,
    scheduleEndTime: profile.scheduleEndTime || null,
    scheduleDaysEnabledJson: profile.scheduleDaysEnabled
      ? JSON.stringify(profile.scheduleDaysEnabled)
      : null,
    deletedAtTimestampMs: profile.deletedAtTimestampMs || null,
    storageID: profile.storageID || null,
    storageVersion: profile.storageVersion || null,
    storageNeedsSync: profile.storageNeedsSync ? 1 : 0,
    storageUnknownFields: profile.storageUnknownFields || null,
  };
}

function getAllNotificationProfiles(
  db: ReadableDB
): Array<NotificationProfileType> {
  const notificationProfiles = db
    .prepare('SELECT * FROM notificationProfiles ORDER BY createdAtMs DESC;')
    .all<NotificationProfileForDatabase>();

  return notificationProfiles.map(hydrateNotificationProfile);
}
function getNotificationProfileById(
  db: ReadableDB,
  id: string
): NotificationProfileType | undefined {
  const [query, parameters] =
    sql`SELECT * FROM notificationProfiles WHERE id = ${id}`;
  const fromDatabase = db
    .prepare(query)
    .get<NotificationProfileForDatabase>(parameters);

  if (fromDatabase) {
    return hydrateNotificationProfile(fromDatabase);
  }

  return undefined;
}
function _deleteAllNotificationProfiles(db: WritableDB): void {
  db.prepare('DELETE FROM notificationProfiles;').run();
}
function deleteNotificationProfileById(db: WritableDB, id: string): void {
  const [query, parameters] =
    sql`DELETE FROM notificationProfiles WHERE id = ${id}`;
  db.prepare(query).run(parameters);
}
function markNotificationProfileDeleted(
  db: WritableDB,
  id: string
): number | undefined {
  const now = new Date().getTime();

  const [query, parameters] = sql`
      UPDATE notificationProfiles
      SET
        deletedAtTimestampMs = ${now},
        storageNeedsSync = 1
      WHERE
        id = ${id} AND
        deletedAtTimestampMs IS NULL
      RETURNING deletedAtTimestampMs`;

  const record = db
    .prepare(query)
    .get<{ deletedAtTimestampMs: number }>(parameters);

  return record?.deletedAtTimestampMs;
}
function createNotificationProfile(
  db: WritableDB,
  profile: NotificationProfileType
): void {
  strictAssert(profile.name, 'Notification profile does not have a valid name');

  const forDatabase = freezeNotificationProfile(profile);

  db.prepare(
    `
      INSERT INTO notificationProfiles(
        id,
        name,
        emoji,
        color,
        createdAtMs,
        allowAllCalls,
        allowAllMentions,
        allowedMembersJson,
        scheduleEnabled,
        scheduleStartTime,
        scheduleEndTime,
        scheduleDaysEnabledJson,
        deletedAtTimestampMs,
        storageID,
        storageVersion,
        storageUnknownFields,
        storageNeedsSync
      ) VALUES (
        $id,
        $name,
        $emoji,
        $color,
        $createdAtMs,
        $allowAllCalls,
        $allowAllMentions,
        $allowedMembersJson,
        $scheduleEnabled,
        $scheduleStartTime,
        $scheduleEndTime,
        $scheduleDaysEnabledJson,
        $deletedAtTimestampMs,
        $storageID,
        $storageVersion,
        $storageUnknownFields,
        $storageNeedsSync
      );
      `
  ).run(forDatabase);
}
function updateNotificationProfile(
  db: WritableDB,
  profile: NotificationProfileType
): void {
  strictAssert(profile.name, 'Notification profile does not have a valid name');

  db.transaction(() => {
    const forDatabase = freezeNotificationProfile(profile);

    db.prepare(
      `
      UPDATE notificationProfiles SET
        name = $name,
        emoji = $emoji,
        color = $color,
        createdAtMs = $createdAtMs,
        allowAllCalls = $allowAllCalls,
        allowAllMentions = $allowAllMentions,
        allowedMembersJson = $allowedMembersJson,
        scheduleEnabled = $scheduleEnabled,
        scheduleStartTime = $scheduleStartTime,
        scheduleEndTime = $scheduleEndTime,
        scheduleDaysEnabledJson = $scheduleDaysEnabledJson,
        deletedAtTimestampMs = $deletedAtTimestampMs,
        storageID = $storageID,
        storageVersion = $storageVersion,
        storageUnknownFields = $storageUnknownFields,
        storageNeedsSync = $storageNeedsSync
      WHERE
        id = $id;
      `
    ).run(forDatabase);
  })();
}

// All data in database
function removeAll(db: WritableDB): void {
  db.transaction(() => {
    db.exec(`
      --- Remove messages delete trigger for performance
      DROP   TRIGGER messages_on_delete;

      DELETE FROM attachment_downloads;
      DELETE FROM attachment_backup_jobs;
      DELETE FROM attachment_downloads_backup_stats;
      DELETE FROM backup_cdn_object_metadata;
      DELETE FROM badgeImageFiles;
      DELETE FROM badges;
      DELETE FROM callLinks;
      DELETE FROM callsHistory;
      DELETE FROM chatFolders;
      DELETE FROM conversations;
      DELETE FROM defunctCallLinks;
      DELETE FROM donationReceipts;
      DELETE FROM emojis;
      DELETE FROM groupCallRingCancellations;
      DELETE FROM groupSendCombinedEndorsement;
      DELETE FROM groupSendMemberEndorsement;
      DELETE FROM identityKeys;
      DELETE FROM items;
      DELETE FROM jobs;
      DELETE FROM kyberPreKeys;
      DELETE FROM message_attachments;
      DELETE FROM messages_fts;
      DELETE FROM messages;
      DELETE FROM notificationProfiles;
      DELETE FROM preKeys;
      DELETE FROM reactions;
      DELETE FROM recentGifs;
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
      DELETE FROM syncTasks;
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

    resetBackupAttachmentDownloadStats(db);
  })();
}

// Anything that isn't user-visible data
function removeAllConfiguration(db: WritableDB): void {
  db.transaction(() => {
    db.exec(
      `
      DELETE FROM attachment_backup_jobs;
      DELETE FROM attachment_downloads;
      DELETE FROM backup_cdn_object_metadata;
      DELETE FROM groupSendCombinedEndorsement;
      DELETE FROM groupSendMemberEndorsement;
      DELETE FROM jobs;
      DELETE FROM kyberPreKeys;
      DELETE FROM preKeys;
      DELETE FROM senderKeys;
      DELETE FROM sendLogMessageIds;
      DELETE FROM sendLogPayloads;
      DELETE FROM sendLogRecipients;
      DELETE FROM sessions;
      DELETE FROM signedPreKeys;
      DELETE FROM syncTasks;
      DELETE FROM unprocessed;
      `
    );

    const itemIds: ReadonlyArray<string> = db
      .prepare('SELECT id FROM items', {
        pluck: true,
      })
      .all();

    const allowedSet = new Set<string>(STORAGE_UI_KEYS);
    for (const id of itemIds) {
      if (!allowedSet.has(id)) {
        removeById(db, 'items', id);
      }
    }

    db.exec(
      `
        UPDATE storyDistributions SET senderKeyInfoJson = NULL;
      `
    );

    /** Update conversations */
    const [updateConversationsQuery, updateConversationsParams] = sql`
      UPDATE conversations
      SET
        expireTimerVersion = ${INITIAL_EXPIRE_TIMER_VERSION},
        json = json_remove(
          json,
          '$.senderKeyInfo',
          '$.storageID',
          '$.needsStorageServiceSync',
          '$.storageUnknownFields',
          '$.expireTimerVersion'
        );
    `;
    db.prepare(updateConversationsQuery).run(updateConversationsParams);
  })();
}

function eraseStorageServiceState(db: WritableDB): void {
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

    -- Call links
    UPDATE callLinks
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0;

    -- Chat Folders
    UPDATE chatFolders
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0; 

    -- Notification Profiles
    UPDATE notificationProfiles
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0;
  `);
}

const MAX_MESSAGE_MIGRATION_ATTEMPTS = 5;

function getMessagesNeedingUpgrade(
  db: ReadableDB,
  limit: number,
  { maxVersion }: { maxVersion: number }
): Array<MessageType> {
  return db.transaction(() => {
    const rows: Array<MessageTypeUnhydrated> = db
      .prepare(
        `
      SELECT ${MESSAGE_COLUMNS.join(', ')}
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

    return hydrateMessages(db, rows);
  })();
}

// Exported for tests
export function incrementMessagesMigrationAttempts(
  db: WritableDB,
  messageIds: ReadonlyArray<string>
): void {
  batchMultiVarQuery(
    db,
    messageIds,
    (batch: ReadonlyArray<string>, persistent: boolean): void => {
      const idSet = sqlJoin(batch);
      const [sqlQuery, sqlParams] = sql`
        UPDATE
          messages
        SET
          json = json_set(
            json,
            '$.schemaMigrationAttempts',
            IFNULL(json -> '$.schemaMigrationAttempts', 0) + 1
          )
        WHERE
          id IN (${idSet})
      `;
      db.prepare(sqlQuery, { persistent }).run(sqlParams);
    }
  );
}

function getMessageServerGuidsForSpam(
  db: ReadableDB,
  conversationId: string
): Array<string> {
  // The server's maximum is 3, which is why you see `LIMIT 3` in this query. Note that we
  //   use `pluck` here to only get the first column!
  return db
    .prepare(
      `
  SELECT serverGuid
  FROM messages
  WHERE conversationId = $conversationId
  AND type = 'incoming'
  AND serverGuid IS NOT NULL
  ORDER BY received_at DESC, sent_at DESC
  LIMIT 3;
  `,
      {
        pluck: true,
      }
    )
    .all({ conversationId });
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

function getKnownMessageAttachments(
  db: ReadableDB,
  cursor?: MessageAttachmentsCursorType
): GetKnownMessageAttachmentsResultType {
  const innerCursor = cursor as MessageCursorType | undefined as
    | PageMessagesCursorType
    | undefined;
  const attachments = new Set<string>();
  const downloads = new Set<string>();

  const { messages, cursor: newCursor } = pageMessages(db, innerCursor);
  for (const message of messages) {
    const { externalAttachments, externalDownloads } =
      getFilePathsOwnedByMessage(message);
    externalAttachments.forEach(file => attachments.add(file));
    externalDownloads.forEach(file => downloads.add(file));
  }

  return {
    attachments: Array.from(attachments),
    downloads: Array.from(downloads),
    cursor: newCursor as MessageCursorType as MessageAttachmentsCursorType,
  };
}

function finishGetKnownMessageAttachments(
  db: ReadableDB,
  cursor: MessageAttachmentsCursorType
): void {
  const innerCursor = cursor as MessageCursorType as PageMessagesCursorType;

  finishPageMessages(db, innerCursor);
}

function pageMessages(
  db: ReadableDB,
  cursor?: PageMessagesCursorType
): PageMessagesResultType {
  const writable = toUnsafeWritableDB(db, 'only temp table use');
  const chunkSize = 1000;

  return writable.transaction(() => {
    let count = cursor?.count ?? 0;

    strictAssert(!cursor?.done, 'pageMessages: iteration cannot be restarted');

    let runId: string;
    if (cursor === undefined) {
      runId = randomBytes(8).toString('hex');

      const total = getMessageCount(db);
      logger.info(
        `pageMessages(${runId}): ` +
          `Starting iteration through ${total} messages`
      );

      writable.exec(
        `
        CREATE TEMP TABLE tmp_${runId}_updated_messages
          (rowid INTEGER PRIMARY KEY, received_at INTEGER, sent_at INTEGER);

        CREATE INDEX tmp_${runId}_updated_messages_received_at
          ON tmp_${runId}_updated_messages (received_at ASC, sent_at ASC);

        INSERT INTO tmp_${runId}_updated_messages
          (rowid, received_at, sent_at)
          SELECT rowid, received_at, sent_at FROM messages
          ORDER BY received_at ASC, sent_at ASC;

        CREATE TEMP TRIGGER tmp_${runId}_message_updates
        UPDATE OF json ON messages
        BEGIN
          INSERT OR IGNORE INTO tmp_${runId}_updated_messages
          (rowid, received_at, sent_at)
          VALUES (NEW.rowid, NEW.received_at, NEW.sent_at);
        END;

        CREATE TEMP TRIGGER tmp_${runId}_message_inserts
        AFTER INSERT ON messages
        BEGIN
          INSERT OR IGNORE INTO tmp_${runId}_updated_messages
          (rowid, received_at, sent_at)
          VALUES (NEW.rowid, NEW.received_at, NEW.sent_at);
        END;
        `
      );
    } else {
      ({ runId } = cursor);
    }

    const rowids: Array<number> = writable
      .prepare(
        `
      DELETE FROM tmp_${runId}_updated_messages
      RETURNING rowid
      ORDER BY received_at ASC, sent_at ASC
      LIMIT $chunkSize;
    `,
        {
          pluck: true,
        }
      )
      .all({ chunkSize });

    const messages = batchMultiVarQuery(
      writable,
      rowids,
      (
        batch: ReadonlyArray<number>,
        persistent: boolean
      ): Array<MessageType> => {
        const query = writable.prepare(
          `
          SELECT ${MESSAGE_COLUMNS.join(', ')}
          FROM messages
          WHERE rowid IN (${Array(batch.length).fill('?').join(',')});
          `,
          { persistent }
        );
        const rows: Array<MessageTypeUnhydrated> = query.all(batch);
        return hydrateMessages(db, rows);
      }
    );

    count += messages.length;
    const done = rowids.length < chunkSize;
    const newCursor: MessageCursorType = { runId, count, done };

    return {
      messages,
      cursor: newCursor as PageMessagesCursorType,
    };
  })();
}

function finishPageMessages(
  db: ReadableDB,
  { runId, count, done }: PageMessagesCursorType
): void {
  const writable = toUnsafeWritableDB(db, 'only temp table use');

  const logId = `finishPageMessages(${runId})`;
  if (!done) {
    logger.warn(`${logId}: iteration not finished`);
  }

  logger.info(`${logId}: reached the end after processing ${count} messages`);
  writable.exec(`
    DROP TABLE tmp_${runId}_updated_messages;
    DROP TRIGGER tmp_${runId}_message_updates;
    DROP TRIGGER tmp_${runId}_message_inserts;
  `);
}

function getKnownDownloads(db: ReadableDB): Array<string> {
  const result = [];

  const backup = getItemById(db, 'backupDownloadPath');
  if (backup) {
    result.push(backup.value);
  }

  return result;
}

function getKnownConversationAttachments(db: ReadableDB): Array<string> {
  const result = new Set<string>();
  const chunkSize = 500;

  let complete = false;
  let id = '';

  const conversationTotal = getConversationCount(db);
  logger.info(
    'getKnownConversationAttachments: About to iterate through ' +
      `${conversationTotal}`
  );

  const fetchConversations = db.prepare(
    `
      SELECT json FROM conversations
      WHERE id > $id
      ORDER BY id ASC
      LIMIT $chunkSize;
    `
  );

  while (!complete) {
    const rows = fetchConversations.all<{ json: string }>({
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

function removeKnownStickers(
  db: WritableDB,
  allStickers: ReadonlyArray<string>
): Array<string> {
  const lookup: Dictionary<boolean> = fromPairs(
    map(allStickers, file => [file, true])
  );
  const chunkSize = 50;

  const total = getStickerCount(db);
  logger.info(
    `removeKnownStickers: About to iterate through ${total} stickers`
  );

  let count = 0;
  let complete = false;
  let rowid = 0;

  while (!complete) {
    const rows: Array<{ rowid: number; path: string }> = db
      .prepare(
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

function removeKnownDraftAttachments(
  db: WritableDB,
  allStickers: ReadonlyArray<string>
): Array<string> {
  const lookup: Dictionary<boolean> = fromPairs(
    map(allStickers, file => [file, true])
  );
  const chunkSize = 50;

  const total = getConversationCount(db);
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
      .prepare(
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

export function getJobsInQueue(
  db: ReadableDB,
  queueType: string
): Array<StoredJob> {
  return db
    .prepare(
      `
      SELECT id, timestamp, data
      FROM jobs
      WHERE queueType = $queueType
      ORDER BY timestamp;
      `
    )
    .all<{ id: string; timestamp: number; data: string }>({ queueType })
    .map(row => ({
      id: row.id,
      queueType,
      timestamp: row.timestamp,
      data: isNotNil(row.data) ? JSON.parse(row.data) : undefined,
    }));
}

export function insertJob(db: WritableDB, job: Readonly<StoredJob>): void {
  db.prepare(
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

function deleteJob(db: WritableDB, id: string): void {
  db.prepare('DELETE FROM jobs WHERE id = $id').run({ id });
}

function wasGroupCallRingPreviouslyCanceled(
  db: ReadableDB,
  ringId: bigint
): boolean {
  return (
    db
      .prepare(
        `
  SELECT EXISTS (
    SELECT 1 FROM groupCallRingCancellations
    WHERE ringId = $ringId
    AND createdAt >= $ringsOlderThanThisAreIgnored
  );
  `,
        {
          pluck: true,
          bigint: true,
        }
      )
      .get<bigint>({
        ringId,
        ringsOlderThanThisAreIgnored: Date.now() - MAX_GROUP_CALL_RING_AGE,
      }) === 1n
  );
}

function processGroupCallRingCancellation(
  db: WritableDB,
  ringId: bigint
): void {
  db.prepare(
    `
    INSERT INTO groupCallRingCancellations (ringId, createdAt)
    VALUES ($ringId, $createdAt)
    ON CONFLICT (ringId) DO NOTHING;
    `,
    { bigint: true }
  ).run({ ringId, createdAt: Date.now() });
}

// This age, in milliseconds, should be longer than any group call ring duration. Beyond
//   that, it doesn't really matter what the value is.
const MAX_GROUP_CALL_RING_AGE = 30 * durations.MINUTE;

function cleanExpiredGroupCallRingCancellations(db: WritableDB): void {
  db.prepare(
    `
    DELETE FROM groupCallRingCancellations
    WHERE createdAt < $expiredRingTime;
    `
  ).run({
    expiredRingTime: Date.now() - MAX_GROUP_CALL_RING_AGE,
  });
}

function getMaxMessageCounter(db: ReadableDB): number | undefined {
  return db
    .prepare(
      `
SELECT MAX(counter)
FROM
  (
    SELECT MAX(received_at) AS counter FROM messages
    UNION
    SELECT MAX(timestamp) AS counter FROM unprocessed
  )
`,
      {
        pluck: true,
      }
    )
    .get();
}

function getStatisticsForLogging(db: ReadableDB): Record<string, string> {
  const counts = {
    messageCount: getMessageCount(db),
    conversationCount: getConversationCount(db),
    sessionCount: getCountFromTable(db, 'sessions'),
    senderKeyCount: getCountFromTable(db, 'senderKeys'),
  };
  return mapValues(counts, formatCountForLogging);
}

function updateAllConversationColors(
  db: WritableDB,
  conversationColor?: ConversationColorType,
  customColorData?: {
    id: string;
    value: CustomColorType;
  }
): void {
  db.prepare(
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

function removeAllProfileKeyCredentials(db: WritableDB): void {
  db.exec(
    `
    UPDATE conversations
    SET
      json = json_remove(json, '$.profileKeyCredential')
    `
  );
}

function saveEditedMessages(
  db: WritableDB,
  mainMessage: ReadonlyDeep<MessageType>,
  ourAci: AciString,
  history: ReadonlyArray<ReadonlyDeep<EditedMessageType>>
): void {
  db.transaction(() => {
    saveMessage(db, mainMessage, {
      ourAci,
      alreadyInTransaction: true,
    });

    try {
      for (const { conversationId, messageId, readStatus, sentAt } of history) {
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
          ${readStatus ?? null}
        );
      `;

        db.prepare(query).run(params);
      }
    } catch (e) {
      const [messageExistsQuery, messageExistsParams] = sql`
        SELECT EXISTS(
          SELECT 1 FROM messages
          WHERE messages.id = ${mainMessage.id}
        );
      `;
      const messageExists = db
        .prepare(messageExistsQuery, {
          pluck: true,
        })
        .get<number>(messageExistsParams);

      if (messageExists !== 1) {
        logger.warn(
          'saveEditedMessages: save failed because message does not exist'
        );
      } else {
        // Some other, unknown error
        throw e;
      }
    }
  })();
}

function saveEditedMessage(
  db: WritableDB,
  mainMessage: ReadonlyDeep<MessageType>,
  ourAci: AciString,
  editedMessage: ReadonlyDeep<EditedMessageType>
): void {
  return saveEditedMessages(db, mainMessage, ourAci, [editedMessage]);
}

function _getAllEditedMessages(
  db: ReadableDB
): Array<{ messageId: string; sentAt: number }> {
  return db
    .prepare(
      `
      SELECT * FROM edited_messages;
      `
    )
    .all({});
}

function getUnreadEditedMessagesAndMarkRead(
  db: WritableDB,
  {
    conversationId,
    readMessageReceivedAt,
  }: {
    conversationId: string;
    readMessageReceivedAt: number;
  }
): GetUnreadByConversationAndMarkReadResultType {
  return db.transaction(() => {
    const editedColumns = MESSAGE_COLUMNS_FRAGMENTS.filter(
      name => name.fragment !== 'sent_at' && name.fragment !== 'readStatus'
    ).map(name => sqlFragment`messages.${name}`);

    const [selectQuery, selectParams] = sql`
      SELECT
        ${sqlJoin(editedColumns)},
        edited_messages.sentAt as sent_at,
        edited_messages.readStatus
      FROM edited_messages
      JOIN messages
        ON messages.id = edited_messages.messageId
      WHERE
        edited_messages.readStatus = ${ReadStatus.Unread} AND
        edited_messages.conversationId = ${conversationId} AND
        received_at <= ${readMessageReceivedAt}
      ORDER BY messages.received_at DESC, messages.sent_at DESC;
    `;

    const rows = db
      .prepare(selectQuery)
      .all<MessageTypeUnhydrated>(selectParams);

    if (rows.length) {
      const newestSentAt = rows[0].sent_at;

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

    return hydrateMessages(db, rows).map(msg => {
      return {
        originalReadStatus: msg.readStatus ?? undefined,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        ...pick(msg, [
          'conversationId',
          'expirationStartTimestamp',
          'id',
          'received_at',
          'sent_at',
          'source',
          'sourceServiceId',
          'timestamp',
          'type',
        ]),
      } satisfies MessageType & { originalReadStatus: ReadStatus | undefined };
    });
  })();
}

function getMessageCountBySchemaVersion(
  db: ReadableDB
): MessageCountBySchemaVersionType {
  const [query, params] = sql`
    SELECT schemaVersion, COUNT(1) as count from messages
    GROUP BY schemaVersion;
  `;
  const rows = db
    .prepare(query)
    .all<{ schemaVersion: number; count: number }>(params);

  return rows.sort((a, b) => a.schemaVersion - b.schemaVersion);
}

function getMessageSampleForSchemaVersion(
  db: ReadableDB,
  version: number
): Array<MessageAttributesType> {
  return db.transaction(() => {
    const [query, params] = sql`
      SELECT * from messages
      WHERE schemaVersion = ${version}
      ORDER BY RANDOM()
      LIMIT 2;
    `;
    const rows = db.prepare(query).all<MessageTypeUnhydrated>(params);

    return hydrateMessages(db, rows);
  })();
}

function disableMessageInsertTriggers(db: WritableDB): void {
  db.transaction(() => {
    createOrUpdateItem(db, {
      id: 'messageInsertTriggersDisabled',
      value: true,
    });
    db.exec('DROP TRIGGER IF EXISTS messages_on_insert;');
    db.exec('DROP TRIGGER IF EXISTS messages_on_insert_insert_mentions;');
  })();
}

const selectMentionsFromMessages = `
  SELECT messages.id, bodyRanges.value ->> 'mentionAci' as mentionAci,
    bodyRanges.value ->> 'start' as start,
    bodyRanges.value ->> 'length' as length
  FROM messages, json_each(messages.json ->> 'bodyRanges') as bodyRanges
  WHERE bodyRanges.value ->> 'mentionAci' IS NOT NULL
`;

function disableFSync(db: WritableDB): void {
  db.pragma('checkpoint_fullfsync = false');
  db.pragma('synchronous = OFF');
}

function enableFSyncAndCheckpoint(db: WritableDB): void {
  db.pragma('checkpoint_fullfsync = true');
  db.pragma('synchronous = FULL');

  // Finally fully commit WAL into the database
  db.pragma('wal_checkpoint(FULL)');
}

function enableMessageInsertTriggersAndBackfill(db: WritableDB): void {
  const createTriggersQuery = `
      DROP TRIGGER IF EXISTS messages_on_insert;
      CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
        WHEN new.isViewOnce IS NOT 1 AND new.storyId IS NULL
        BEGIN
          INSERT INTO messages_fts
            (rowid, body)
          VALUES
            (new.rowid, new.body);
      END;

      DROP TRIGGER IF EXISTS messages_on_insert_insert_mentions;
      CREATE TRIGGER messages_on_insert_insert_mentions AFTER INSERT ON messages
      BEGIN
        INSERT INTO mentions (messageId, mentionAci, start, length)
        ${selectMentionsFromMessages}
        AND messages.id = new.id;
      END;
  `;
  db.transaction(() => {
    backfillMentionsTable(db);
    backfillMessagesFtsTable(db);
    db.exec(createTriggersQuery);
    createOrUpdateItem(db, {
      id: 'messageInsertTriggersDisabled',
      value: false,
    });
  })();
}

function backfillMessagesFtsTable(db: WritableDB): void {
  db.exec(`
    DELETE FROM messages_fts;
    INSERT OR REPLACE INTO messages_fts (rowid, body)
      SELECT rowid, body
      FROM messages
      WHERE isViewOnce IS NOT 1 AND storyId IS NULL;
  `);
}

function backfillMentionsTable(db: WritableDB): void {
  db.exec(`
    DELETE FROM mentions;
    INSERT INTO mentions (messageId, mentionAci, start, length)
    ${selectMentionsFromMessages};
  `);
}

function ensureMessageInsertTriggersAreEnabled(db: WritableDB): void {
  db.transaction(() => {
    const storedItem = getItemById(db, 'messageInsertTriggersDisabled');
    const triggersDisabled = storedItem?.value;
    if (triggersDisabled) {
      logger.warn(
        'Message insert triggers were disabled; reenabling and backfilling data'
      );
      enableMessageInsertTriggersAndBackfill(db);
    }
  })();
}

function __dangerouslyRunAbitraryReadOnlySqlQuery(
  db: ReadableDB,
  readOnlySqlQuery: string
): ReadonlyArray<RowType<object>> {
  let results: ReadonlyArray<RowType<object>>;
  try {
    db.pragma('query_only = on');
    results = db.prepare(readOnlySqlQuery).all();
  } finally {
    db.pragma('query_only = off');
  }
  return results;
}
