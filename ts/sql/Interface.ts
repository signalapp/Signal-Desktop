// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';
import type { ReadonlyDeep } from 'type-fest';
import type {
  ConversationAttributesType,
  MessageAttributesType,
  SenderKeyInfoType,
} from '../model-types.d';
import type { StoredJob } from '../jobs/types';
import type { ReactionType, ReactionReadStatus } from '../types/Reactions';
import type { ConversationColorType, CustomColorType } from '../types/Colors';
import type { StorageAccessType } from '../types/Storage.d';
import type { BytesToStrings } from '../types/Util';
import type { QualifiedAddressStringType } from '../types/QualifiedAddress';
import type { StoryDistributionIdString } from '../types/StoryDistributionId';
import type { AciString, PniString, ServiceIdString } from '../types/ServiceId';
import type { BadgeType } from '../badges/types';
import type { ReadStatus } from '../messages/MessageReadStatus';
import type { RawBodyRange } from '../types/BodyRange';
import type {
  GetMessagesBetweenOptions,
  MaybeStaleCallHistory,
} from './Server';
import type { MessageTimestamps } from '../state/ducks/conversations';
import type {
  CallHistoryDetails,
  CallHistoryFilter,
  CallHistoryGroup,
  CallHistoryPagination,
  CallLogEventTarget,
} from '../types/CallDisposition';
import type {
  CallLinkRecord,
  CallLinkStateType,
  CallLinkType,
  DefunctCallLinkType,
} from '../types/CallLink';
import type { AttachmentDownloadJobType } from '../types/AttachmentDownload';
import type {
  GroupSendEndorsementsData,
  GroupSendMemberEndorsementRecord,
} from '../types/GroupSendEndorsements';
import type { SyncTaskType } from '../util/syncTasks';
import type { AttachmentBackupJobType } from '../types/AttachmentBackup';

export type ReadableDB = Database & { __readable_db: never };
export type WritableDB = ReadableDB & { __writable_db: never };

export type AdjacentMessagesByConversationOptionsType = Readonly<{
  conversationId: string;
  messageId?: string;
  includeStoryReplies: boolean;
  limit?: number;
  receivedAt?: number;
  sentAt?: number;
  storyId: string | undefined;
  requireVisualMediaAttachments?: boolean;
  requireFileAttachments?: boolean;
}>;

export type GetNearbyMessageFromDeletedSetOptionsType = Readonly<{
  conversationId: string;
  lastSelectedMessage: MessageTimestamps;
  deletedMessageIds: ReadonlyArray<string>;
  storyId: string | undefined;
  includeStoryReplies: boolean;
}>;

export type MessageMetricsType = {
  id: string;
  received_at: number;
  sent_at: number;
};
export type ConversationMetricsType = {
  oldest?: MessageMetricsType;
  newest?: MessageMetricsType;
  oldestUnseen?: MessageMetricsType;
  totalUnseen: number;
};
export type ConversationType = ConversationAttributesType;
export type EmojiType = {
  shortName: string;
  lastUsage: number;
};

export type IdentityKeyType = {
  firstUse: boolean;
  id: ServiceIdString | `conversation:${string}`;
  nonblockingApproval: boolean;
  publicKey: Uint8Array;
  timestamp: number;
  verified: number;
};
export type StoredIdentityKeyType = {
  firstUse: boolean;
  id: ServiceIdString | `conversation:${string}`;
  nonblockingApproval: boolean;
  publicKey: string;
  timestamp: number;
  verified: number;
};
export type IdentityKeyIdType = IdentityKeyType['id'];

export type ItemKeyType = keyof StorageAccessType;
export type AllItemsType = Partial<StorageAccessType>;
export type StoredAllItemsType = Partial<BytesToStrings<StorageAccessType>>;
export type ItemType<K extends ItemKeyType> = {
  id: K;
  value: StorageAccessType[K];
};
export type StoredItemType<K extends ItemKeyType> = {
  id: K;
  value: BytesToStrings<StorageAccessType[K]>;
};
export type MessageType = MessageAttributesType;

// See: ts/sql/Interface.ts
//
// When adding a new column:
//
// - Make sure the name matches the one in `MessageAttributeTypes`
// - Update `hydrateMessage`
//
export const MESSAGE_COLUMNS = [
  'json',

  'id',
  'body',
  'conversationId',
  'expirationStartTimestamp',
  'expireTimer',
  'hasAttachments',
  'hasFileAttachments',
  'hasVisualMediaAttachments',
  'isChangeCreatedByUs',
  'isErased',
  'isViewOnce',
  'mentionsMe',
  'received_at',
  'received_at_ms',
  'schemaVersion',
  'serverGuid',
  'sent_at',
  'source',
  'sourceServiceId',
  'sourceDevice',
  'storyId',
  'type',
  'readStatus',
  'seenStatus',
  'serverTimestamp',
  'timestamp',
  'unidentifiedDeliveryReceived',
] as const;

export type MessageTypeUnhydrated = {
  json: string;

  id: string;
  body: string | null;
  conversationId: string | null;
  expirationStartTimestamp: number | null;
  expireTimer: number | null;
  hasAttachments: 0 | 1 | null;
  hasFileAttachments: 0 | 1 | null;
  hasVisualMediaAttachments: 0 | 1 | null;
  isChangeCreatedByUs: 0 | 1 | null;
  isErased: 0 | 1 | null;
  isViewOnce: 0 | 1 | null;
  mentionsMe: 0 | 1 | null;
  received_at: number | null;
  received_at_ms: number | null;
  schemaVersion: number | null;
  serverGuid: string | null;
  sent_at: number | null;
  source: string | null;
  sourceServiceId: string | null;
  sourceDevice: number | null;
  serverTimestamp: number | null;
  storyId: string | null;
  type: string;
  timestamp: number | null;
  readStatus: number | null;
  seenStatus: number | null;
  unidentifiedDeliveryReceived: 0 | 1 | null;
};

export type PreKeyIdType = `${ServiceIdString}:${number}`;
export type KyberPreKeyType = {
  id: PreKeyIdType;

  createdAt: number;
  data: Uint8Array;
  isConfirmed: boolean;
  isLastResort: boolean;
  keyId: number;
  ourServiceId: ServiceIdString;
};
export type StoredKyberPreKeyType = KyberPreKeyType & {
  data: string;
};
export type PreKeyType = {
  id: PreKeyIdType;

  createdAt: number;
  keyId: number;
  ourServiceId: ServiceIdString;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
};

export type StoredPreKeyType = PreKeyType & {
  privateKey: string;
  publicKey: string;
};
export type ServerSearchResultMessageType = MessageTypeUnhydrated & {
  // If the FTS matches text in message.body, snippet will be populated
  ftsSnippet: string | null;

  // Otherwise, a matching mention will be returned
  mentionAci: string | null;
  mentionStart: number | null;
  mentionLength: number | null;
};
export type ClientSearchResultMessageType = MessageType & {
  bodyRanges: ReadonlyArray<RawBodyRange>;
  snippet: string;
};

export type SentProtoType = {
  contentHint: number;
  proto: Uint8Array;
  timestamp: number;
  urgent: boolean;
  hasPniSignatureMessage: boolean;
};
export type SentProtoWithMessageIdsType = SentProtoType & {
  messageIds: Array<string>;
};
export type SentRecipientsType = Record<ServiceIdString, Array<number>>;
export type SentMessagesType = Array<string>;

// These two are for test only
export type SentRecipientsDBType = {
  payloadId: number;
  recipientServiceId: ServiceIdString;
  deviceId: number;
};
export type SentMessageDBType = {
  payloadId: number;
  messageId: string;
};

export type SenderKeyType = {
  // Primary key
  id: `${QualifiedAddressStringType}--${string}`;
  // These two are combined into one string to give us the final id
  senderId: string;
  distributionId: string;
  // Raw data to serialize/deserialize into signal-client SenderKeyRecord
  data: Uint8Array;
  lastUpdatedDate: number;
};
export type SenderKeyIdType = SenderKeyType['id'];
export type SessionType = {
  id: QualifiedAddressStringType;
  ourServiceId: ServiceIdString;
  serviceId: ServiceIdString;
  conversationId: string;
  deviceId: number;
  record: Uint8Array;
};
export type SessionIdType = SessionType['id'];
export type SignedPreKeyType = {
  confirmed: boolean;
  created_at: number;
  ourServiceId: ServiceIdString;
  id: `${ServiceIdString}:${number}`;
  keyId: number;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
};
export type StoredSignedPreKeyType = {
  confirmed: boolean;
  created_at: number;
  ourServiceId: ServiceIdString;
  id: `${ServiceIdString}:${number}`;
  keyId: number;
  privateKey: string;
  publicKey: string;
};
export type SignedPreKeyIdType = SignedPreKeyType['id'];

export type StickerType = Readonly<{
  id: number;
  packId: string;

  emoji?: string;
  isCoverOnly: boolean;
  lastUsed?: number;
  path: string;

  width: number;
  height: number;

  version: 1 | 2;
  localKey?: string;
  size?: number;
}>;

export const StickerPackStatuses = [
  'known',
  'ephemeral',
  'downloaded',
  'installed',
  'pending',
  'error',
] as const;

export type StickerPackStatusType = (typeof StickerPackStatuses)[number];

export type StorageServiceFieldsType = Readonly<{
  storageID?: string;
  storageVersion?: number;
  storageUnknownFields?: Uint8Array | null;
  storageNeedsSync: boolean;
}>;

export type InstalledStickerPackType = Readonly<{
  id: string;
  key: string;

  uninstalledAt?: undefined;
  position?: number | null;
}> &
  StorageServiceFieldsType;

export type UninstalledStickerPackType = Readonly<{
  id: string;
  key?: undefined;

  uninstalledAt: number;
  position?: undefined;
}> &
  StorageServiceFieldsType;

export type StickerPackInfoType =
  | InstalledStickerPackType
  | UninstalledStickerPackType;

export type StickerPackType = InstalledStickerPackType &
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
    stickers: Record<string, StickerType>;
    title: string;
  }>;

export type StickerPackRefType = Readonly<{
  packId: string;
  messageId: string;
  stickerId: number;
  isUnresolved: boolean;
}>;

export type UnprocessedType = {
  id: string;
  timestamp: number;
  /*
   * A client generated date used for removing old envelopes from the table
   * on startup.
   */
  receivedAtDate: number;
  receivedAtCounter: number;
  attempts: number;
  type: number;
  isEncrypted: boolean;
  content: Uint8Array;

  messageAgeSec: number;
  source: string | undefined;
  sourceServiceId: ServiceIdString | undefined;
  sourceDevice: number | undefined;
  destinationServiceId: ServiceIdString;
  updatedPni: PniString | undefined;
  serverGuid: string;
  serverTimestamp: number;
  urgent: boolean;
  story: boolean;
  reportingToken: Uint8Array | undefined;
  groupId: string | undefined;
};

export type ConversationMessageStatsType = {
  activity?: MessageType;
  preview?: MessageType;
  hasUserInitiatedMessages: boolean;
};

export type DeleteSentProtoRecipientOptionsType = Readonly<{
  timestamp: number;
  recipientServiceId: ServiceIdString;
  deviceId: number;
}>;

export type DeleteSentProtoRecipientResultType = Readonly<{
  successfulPhoneNumberShares: ReadonlyArray<ServiceIdString>;
}>;

export type StoryDistributionType = Readonly<{
  id: StoryDistributionIdString;
  name: string;
  deletedAtTimestamp?: number;
  allowsReplies: boolean;
  isBlockList: boolean;
  senderKeyInfo: SenderKeyInfoType | undefined;
}> &
  StorageServiceFieldsType;
export type StoryDistributionMemberType = Readonly<{
  listId: StoryDistributionIdString;
  serviceId: ServiceIdString;
}>;
export type StoryDistributionWithMembersType = Readonly<
  {
    members: Array<ServiceIdString>;
  } & StoryDistributionType
>;

export type StoryReadType = Readonly<{
  authorId: ServiceIdString;
  conversationId: string;
  storyId: string;
  storyReadDate: number;
}>;

export type ReactionResultType = Pick<
  ReactionType,
  'targetAuthorAci' | 'targetTimestamp' | 'messageId'
> & { rowid: number };

export type GetUnreadByConversationAndMarkReadResultType = Array<
  { originalReadStatus: ReadStatus | undefined } & Pick<
    MessageType,
    | 'id'
    | 'source'
    | 'sourceServiceId'
    | 'sent_at'
    | 'type'
    | 'readStatus'
    | 'seenStatus'
    | 'expirationStartTimestamp'
  >
>;

export type GetConversationRangeCenteredOnMessageResultType<Message> =
  Readonly<{
    older: Array<Message>;
    newer: Array<Message>;
    metrics: ConversationMetricsType;
  }>;

export type MessageCursorType = Readonly<{
  done: boolean;
  runId: string;
  count: number;
}>;

export type MessageAttachmentsCursorType = MessageCursorType &
  Readonly<{
    __message_attachments_cursor: never;
  }>;

export type GetKnownMessageAttachmentsResultType = Readonly<{
  cursor: MessageAttachmentsCursorType;
  attachments: ReadonlyArray<string>;
  downloads: ReadonlyArray<string>;
}>;

export type PageMessagesCursorType = MessageCursorType &
  Readonly<{
    __page_messages_cursor: never;
  }>;

export type PageMessagesResultType = Readonly<{
  cursor: PageMessagesCursorType;
  messages: ReadonlyArray<MessageAttributesType>;
}>;

export type GetAllStoriesResultType = ReadonlyArray<
  MessageType & {
    hasReplies: boolean;
    hasRepliesFromSelf: boolean;
  }
>;

export type EditedMessageType = Readonly<{
  conversationId: string;
  messageId: string;
  sentAt: number;
  readStatus: MessageType['readStatus'];
}>;

export type BackupCdnMediaObjectType = {
  mediaId: string;
  cdnNumber: number;
  sizeOnBackupCdn: number;
};

export type GetRecentStoryRepliesOptionsType = {
  limit?: number;
  messageId?: string;
  receivedAt?: number;
  sentAt?: number;
};

export enum AttachmentDownloadSource {
  BACKUP_IMPORT = 'backup_import',
  STANDARD = 'standard',
}

type ReadableInterface = {
  close: () => void;

  getSenderKeyById: (id: SenderKeyIdType) => SenderKeyType | undefined;
  getAllSenderKeys: () => Array<SenderKeyType>;

  getAllSentProtos: () => Array<SentProtoType>;

  // Test-only
  _getAllSentProtoRecipients: () => Array<SentRecipientsDBType>;
  _getAllSentProtoMessageIds: () => Array<SentMessageDBType>;

  getAllSessions: () => Array<SessionType>;

  getConversationCount: () => number;
  getConversationById: (id: string) => ConversationType | undefined;

  getAllConversations: () => Array<ConversationType>;
  getAllConversationIds: () => Array<string>;
  getAllGroupsInvolvingServiceId: (
    serviceId: ServiceIdString
  ) => Array<ConversationType>;

  getGroupSendCombinedEndorsementExpiration: (groupId: string) => number | null;
  getGroupSendEndorsementsData: (
    groupId: string
  ) => GroupSendEndorsementsData | null;
  getGroupSendMemberEndorsement: (
    groupId: string,
    memberAci: AciString
  ) => GroupSendMemberEndorsementRecord | null;

  getMessageCount: (conversationId?: string) => number;
  getStoryCount: (conversationId: string) => number;

  pageMessages: (cursor?: PageMessagesCursorType) => PageMessagesResultType;
  finishPageMessages: (cursor: PageMessagesCursorType) => void;

  getTotalUnreadForConversation: (
    conversationId: string,
    options: {
      storyId: string | undefined;
      includeStoryReplies: boolean;
    }
  ) => number;
  getTotalUnreadMentionsOfMeForConversation: (
    conversationId: string,
    options: {
      storyId?: string;
      includeStoryReplies: boolean;
    }
  ) => number;
  getOldestUnreadMentionOfMeForConversation(
    conversationId: string,
    options: {
      storyId?: string;
      includeStoryReplies: boolean;
    }
  ): MessageMetricsType | undefined;

  getReactionByTimestamp: (
    fromId: string,
    timestamp: number
  ) => ReactionType | undefined;
  _getAllReactions: () => Array<ReactionType>;

  getMessageBySender: (options: {
    source?: string;
    sourceServiceId?: ServiceIdString;
    sourceDevice?: number;
    sent_at: number;
  }) => MessageType | undefined;
  getMessageById: (id: string) => MessageType | undefined;
  getMessagesById: (messageIds: ReadonlyArray<string>) => Array<MessageType>;
  _getAllMessages: () => Array<MessageType>;
  _getAllEditedMessages: () => Array<{ messageId: string; sentAt: number }>;
  getAllMessageIds: () => Array<string>;
  getMessagesBySentAt: (sentAt: number) => Array<MessageType>;
  getExpiredMessages: () => Array<MessageType>;
  getMessagesUnexpectedlyMissingExpirationStartTimestamp: () => Array<MessageType>;
  getSoonestMessageExpiry: () => undefined | number;
  getNextTapToViewMessageTimestampToAgeOut: () => undefined | number;
  getTapToViewMessagesNeedingErase: (
    maxTimestamp: number
  ) => Array<MessageType>;
  // getOlderMessagesByConversation is JSON on server, full message on Client
  getAllStories: (options: {
    conversationId?: string;
    sourceServiceId?: ServiceIdString;
  }) => GetAllStoriesResultType;
  // getNewerMessagesByConversation is JSON on server, full message on Client
  getMessageMetricsForConversation: (options: {
    conversationId: string;
    storyId?: string;
    includeStoryReplies: boolean;
  }) => ConversationMetricsType;
  // getConversationRangeCenteredOnMessage is JSON on server, full message on client
  getConversationMessageStats: (options: {
    conversationId: string;
    includeStoryReplies: boolean;
  }) => ConversationMessageStatsType;
  getLastConversationMessage(options: {
    conversationId: string;
  }): MessageType | undefined;
  getAllCallHistory: () => ReadonlyArray<CallHistoryDetails>;
  getCallHistoryUnreadCount(): number;
  getCallHistoryMessageByCallId(options: {
    conversationId: string;
    callId: string;
  }): MessageType | undefined;
  getCallHistory(
    callId: string,
    peerId: ServiceIdString | string
  ): CallHistoryDetails | undefined;
  getCallHistoryGroupsCount(filter: CallHistoryFilter): number;
  getCallHistoryGroups(
    filter: CallHistoryFilter,
    pagination: CallHistoryPagination
  ): Array<CallHistoryGroup>;
  hasGroupCallHistoryMessage: (
    conversationId: string,
    eraId: string
  ) => boolean;
  callLinkExists(roomId: string): boolean;
  defunctCallLinkExists(roomId: string): boolean;
  getAllCallLinks: () => ReadonlyArray<CallLinkType>;
  getCallLinkByRoomId: (roomId: string) => CallLinkType | undefined;
  getCallLinkRecordByRoomId: (roomId: string) => CallLinkRecord | undefined;
  getAllAdminCallLinks(): ReadonlyArray<CallLinkType>;
  getAllCallLinkRecordsWithAdminKey(): ReadonlyArray<CallLinkRecord>;
  getAllDefunctCallLinksWithAdminKey(): ReadonlyArray<DefunctCallLinkType>;
  getAllMarkedDeletedCallLinkRoomIds(): ReadonlyArray<string>;
  getMessagesBetween: (
    conversationId: string,
    options: GetMessagesBetweenOptions
  ) => Array<string>;
  getNearbyMessageFromDeletedSet: (
    options: GetNearbyMessageFromDeletedSetOptionsType
  ) => string | null;
  getMostRecentAddressableMessages: (
    conversationId: string,
    limit?: number
  ) => Array<MessageType>;
  getMostRecentAddressableNondisappearingMessages: (
    conversationId: string,
    limit?: number
  ) => Array<MessageType>;

  getUnprocessedCount: () => number;
  getUnprocessedById: (id: string) => UnprocessedType | undefined;

  getAttachmentDownloadJob(
    job: Pick<
      AttachmentDownloadJobType,
      'messageId' | 'attachmentType' | 'digest'
    >
  ): AttachmentDownloadJobType;

  getBackupCdnObjectMetadata: (
    mediaId: string
  ) => BackupCdnMediaObjectType | undefined;

  getStickerCount: () => number;
  getAllStickerPacks: () => Array<StickerPackType>;
  getInstalledStickerPacks: () => Array<StickerPackType>;
  getUninstalledStickerPacks: () => Array<UninstalledStickerPackType>;
  getStickerPackInfo: (packId: string) => StickerPackInfoType | undefined;
  getAllStickers: () => Array<StickerType>;
  getRecentStickers: (options?: { limit?: number }) => Array<StickerType>;

  getRecentEmojis: (limit?: number) => Array<EmojiType>;

  getAllBadges(): Array<BadgeType>;

  _getAllStoryDistributions(): Array<StoryDistributionType>;
  _getAllStoryDistributionMembers(): Array<StoryDistributionMemberType>;
  getAllStoryDistributionsWithMembers(): Array<StoryDistributionWithMembersType>;
  getStoryDistributionWithMembers(
    id: string
  ): StoryDistributionWithMembersType | undefined;

  _getAllStoryReads(): Array<StoryReadType>;
  getLastStoryReadsForAuthor(options: {
    authorId: ServiceIdString;
    conversationId?: string;
    limit?: number;
  }): Array<StoryReadType>;
  countStoryReadsByConversation(conversationId: string): number;

  getMessagesNeedingUpgrade: (
    limit: number,
    options: { maxVersion: number }
  ) => Array<MessageType>;
  getMessageServerGuidsForSpam: (conversationId: string) => Array<string>;

  getJobsInQueue(queueType: string): Array<StoredJob>;

  wasGroupCallRingPreviouslyCanceled(ringId: bigint): boolean;

  getMaxMessageCounter(): number | undefined;

  getStatisticsForLogging(): Record<string, string>;
  getSizeOfPendingBackupAttachmentDownloadJobs(): number;
};

type WritableInterface = {
  close: () => void;

  removeIndexedDBFiles: () => void;

  removeIdentityKeyById: (id: IdentityKeyIdType) => number;
  removeAllIdentityKeys: () => number;

  removeKyberPreKeyById: (id: PreKeyIdType | Array<PreKeyIdType>) => number;
  removeKyberPreKeysByServiceId: (serviceId: ServiceIdString) => void;
  removeAllKyberPreKeys: () => number;

  removePreKeyById: (id: PreKeyIdType | Array<PreKeyIdType>) => number;
  removePreKeysByServiceId: (serviceId: ServiceIdString) => void;
  removeAllPreKeys: () => number;

  removeSignedPreKeyById: (
    id: SignedPreKeyIdType | Array<SignedPreKeyIdType>
  ) => number;
  removeSignedPreKeysByServiceId: (serviceId: ServiceIdString) => void;
  removeAllSignedPreKeys: () => number;

  removeAllItems: () => number;
  removeItemById: (id: ItemKeyType | Array<ItemKeyType>) => number;

  createOrUpdateSenderKey: (key: SenderKeyType) => void;
  removeAllSenderKeys: () => void;
  removeSenderKeyById: (id: SenderKeyIdType) => void;

  getSentProtoByRecipient: (options: {
    now: number;
    recipientServiceId: ServiceIdString;
    timestamp: number;
  }) => SentProtoWithMessageIdsType | undefined;
  insertSentProto: (
    proto: SentProtoType,
    options: {
      recipients: SentRecipientsType;
      messageIds: SentMessagesType;
    }
  ) => number;
  deleteSentProtosOlderThan: (timestamp: number) => void;
  deleteSentProtoByMessageId: (messageId: string) => void;
  insertProtoRecipients: (options: {
    id: number;
    recipientServiceId: ServiceIdString;
    deviceIds: Array<number>;
  }) => void;
  deleteSentProtoRecipient: (
    options:
      | DeleteSentProtoRecipientOptionsType
      | ReadonlyArray<DeleteSentProtoRecipientOptionsType>
  ) => DeleteSentProtoRecipientResultType;
  removeAllSentProtos: () => void;

  createOrUpdateSession: (data: SessionType) => void;
  createOrUpdateSessions: (array: Array<SessionType>) => void;
  commitDecryptResult(options: {
    senderKeys: Array<SenderKeyType>;
    sessions: Array<SessionType>;
    unprocessed: Array<UnprocessedType>;
  }): void;
  removeSessionById: (id: SessionIdType) => number;
  removeSessionsByConversation: (conversationId: string) => void;
  removeSessionsByServiceId: (serviceId: ServiceIdString) => void;
  removeAllSessions: () => number;

  saveConversation: (data: ConversationType) => void;
  saveConversations: (array: Array<ConversationType>) => void;
  // updateConversation is a normal data method on Server, a sync batch-add on Client
  updateConversations: (array: Array<ConversationType>) => void;
  // removeConversation handles either one id or an array on Server, and one id on Client
  _removeAllConversations: () => void;
  updateAllConversationColors: (
    conversationColor?: ConversationColorType,
    customColorData?: {
      id: string;
      value: CustomColorType;
    }
  ) => void;
  removeAllProfileKeyCredentials: () => void;

  replaceAllEndorsementsForGroup: (data: GroupSendEndorsementsData) => void;
  deleteAllEndorsementsForGroup: (groupId: string) => void;

  getUnreadByConversationAndMarkRead: (options: {
    conversationId: string;
    includeStoryReplies: boolean;
    newestUnreadAt: number;
    now?: number;
    readAt?: number;
    storyId?: string;
  }) => GetUnreadByConversationAndMarkReadResultType;
  getUnreadEditedMessagesAndMarkRead: (options: {
    conversationId: string;
    newestUnreadAt: number;
  }) => GetUnreadByConversationAndMarkReadResultType;
  getUnreadReactionsAndMarkRead: (options: {
    conversationId: string;
    newestUnreadAt: number;
    storyId?: string;
  }) => Array<ReactionResultType>;
  markReactionAsRead: (
    targetAuthorServiceId: ServiceIdString,
    targetTimestamp: number
  ) => ReactionType | undefined;
  removeReactionFromConversation: (reaction: {
    emoji: string;
    fromId: string;
    targetAuthorServiceId: ServiceIdString;
    targetTimestamp: number;
  }) => void;
  addReaction: (
    reactionObj: ReactionType,
    options: {
      readStatus: ReactionReadStatus;
    }
  ) => void;
  _removeAllReactions: () => void;
  _removeAllMessages: () => void;
  incrementMessagesMigrationAttempts: (
    messageIds: ReadonlyArray<string>
  ) => void;

  clearCallHistory: (target: CallLogEventTarget) => ReadonlyArray<string>;
  _removeAllCallHistory: () => void;
  markCallHistoryDeleted: (callId: string) => void;
  cleanupCallHistoryMessages: () => void;
  markCallHistoryRead(callId: string): void;
  markAllCallHistoryRead(target: CallLogEventTarget): number;
  markAllCallHistoryReadInConversation(target: CallLogEventTarget): number;
  saveCallHistory(callHistory: CallHistoryDetails): void;
  markCallHistoryMissed(callIds: ReadonlyArray<string>): void;
  getRecentStaleRingsAndMarkOlderMissed(): ReadonlyArray<MaybeStaleCallHistory>;
  insertCallLink(callLink: CallLinkType): void;
  updateCallLink(callLink: CallLinkType): void;
  updateCallLinkAdminKeyByRoomId(roomId: string, adminKey: string): void;
  updateCallLinkState(
    roomId: string,
    callLinkState: CallLinkStateType
  ): CallLinkType;
  beginDeleteAllCallLinks(): boolean;
  beginDeleteCallLink(roomId: string): boolean;
  deleteCallHistoryByRoomId(roomid: string): void;
  deleteCallLinkAndHistory(roomId: string): void;
  finalizeDeleteCallLink(roomId: string): void;
  _removeAllCallLinks(): void;
  insertDefunctCallLink(defunctCallLink: DefunctCallLinkType): void;
  updateDefunctCallLink(defunctCallLink: DefunctCallLinkType): void;
  deleteCallLinkFromSync(roomId: string): void;
  migrateConversationMessages: (obsoleteId: string, currentId: string) => void;
  saveEditedMessage: (
    mainMessage: ReadonlyDeep<MessageType>,
    ourAci: AciString,
    opts: ReadonlyDeep<EditedMessageType>
  ) => void;
  saveEditedMessages: (
    mainMessage: ReadonlyDeep<MessageType>,
    ourAci: AciString,
    history: ReadonlyArray<ReadonlyDeep<EditedMessageType>>
  ) => void;

  removeSyncTaskById: (id: string) => void;
  saveSyncTasks: (tasks: Array<SyncTaskType>) => void;

  incrementAllSyncTaskAttempts: () => void;
  dequeueOldestSyncTasks: (options: {
    previousRowId: number | null;
    incrementAttempts?: boolean;
    syncTaskTypes?: Array<SyncTaskType['type']>;
  }) => {
    tasks: Array<SyncTaskType>;
    lastRowId: number | null;
  };

  getAllUnprocessedIds: () => Array<string>;
  getUnprocessedByIdsAndIncrementAttempts: (
    ids: ReadonlyArray<string>
  ) => Array<UnprocessedType>;
  removeUnprocessed: (id: string | Array<string>) => void;

  /** only for testing */
  removeAllUnprocessed: () => void;

  getNextAttachmentDownloadJobs: (options: {
    limit: number;
    prioritizeMessageIds?: Array<string>;
    sources?: Array<AttachmentDownloadSource>;
    timestamp?: number;
  }) => Array<AttachmentDownloadJobType>;
  saveAttachmentDownloadJob: (job: AttachmentDownloadJobType) => void;
  saveAttachmentDownloadJobs: (jobs: Array<AttachmentDownloadJobType>) => void;
  resetAttachmentDownloadActive: () => void;
  removeAttachmentDownloadJob: (job: AttachmentDownloadJobType) => void;
  removeAttachmentDownloadJobsForMessage: (messageId: string) => void;
  removeAllBackupAttachmentDownloadJobs: () => void;

  getNextAttachmentBackupJobs: (options: {
    limit: number;
    timestamp?: number;
  }) => Array<AttachmentBackupJobType>;
  saveAttachmentBackupJob: (job: AttachmentBackupJobType) => void;
  markAllAttachmentBackupJobsInactive: () => void;
  removeAttachmentBackupJob: (job: AttachmentBackupJobType) => void;
  clearAllAttachmentBackupJobs: () => void;

  clearAllBackupCdnObjectMetadata: () => void;
  saveBackupCdnObjectMetadata: (
    mediaObjects: Array<BackupCdnMediaObjectType>
  ) => void;

  createOrUpdateStickerPack: (pack: StickerPackType) => void;
  createOrUpdateStickerPacks: (packs: ReadonlyArray<StickerPackType>) => void;
  // Returns previous sticker pack status
  updateStickerPackStatus: (
    id: string,
    status: StickerPackStatusType,
    options?: { timestamp: number }
  ) => StickerPackStatusType | null;
  updateStickerPackInfo: (info: StickerPackInfoType) => void;
  createOrUpdateSticker: (sticker: StickerType) => void;
  createOrUpdateStickers: (sticker: ReadonlyArray<StickerType>) => void;
  updateStickerLastUsed: (
    packId: string,
    stickerId: number,
    lastUsed: number
  ) => void;
  addStickerPackReference: (ref: StickerPackRefType) => void;
  deleteStickerPackReference: (
    ref: Pick<StickerPackRefType, 'messageId' | 'packId'>
  ) => ReadonlyArray<string> | undefined;
  deleteStickerPack: (packId: string) => Array<string>;
  getUnresolvedStickerPackReferences: (
    packId: string
  ) => Array<StickerPackRefType>;
  addUninstalledStickerPack: (pack: UninstalledStickerPackType) => void;
  addUninstalledStickerPacks: (
    pack: ReadonlyArray<UninstalledStickerPackType>
  ) => void;
  // Returns `true` if sticker pack was previously uninstalled
  installStickerPack: (packId: string, timestamp: number) => boolean;
  // Returns `true` if sticker pack was not previously uninstalled
  uninstallStickerPack: (packId: string, timestamp: number) => boolean;
  clearAllErrorStickerPackAttempts: () => void;

  updateEmojiUsage: (shortName: string, timeUsed?: number) => void;

  updateOrCreateBadges(badges: ReadonlyArray<BadgeType>): void;
  badgeImageFileDownloaded(url: string, localPath: string): void;

  _deleteAllStoryDistributions(): void;
  createNewStoryDistribution(
    distribution: StoryDistributionWithMembersType
  ): void;
  modifyStoryDistribution(distribution: StoryDistributionType): void;
  modifyStoryDistributionMembers(
    listId: string,
    options: {
      toAdd: Array<ServiceIdString>;
      toRemove: Array<ServiceIdString>;
    }
  ): void;
  modifyStoryDistributionWithMembers(
    distribution: StoryDistributionType,
    options: {
      toAdd: Array<ServiceIdString>;
      toRemove: Array<ServiceIdString>;
    }
  ): void;
  deleteStoryDistribution(id: StoryDistributionIdString): void;

  _deleteAllStoryReads(): void;
  addNewStoryRead(read: StoryReadType): void;

  removeAll: () => void;
  removeAllConfiguration: () => void;
  eraseStorageServiceState: () => void;

  insertJob(job: Readonly<StoredJob>): void;
  deleteJob(id: string): void;

  disableMessageInsertTriggers(): void;
  enableMessageInsertTriggersAndBackfill(): void;
  ensureMessageInsertTriggersAreEnabled(): void;

  disableFSync(): void;
  enableFSyncAndCheckpoint(): void;

  processGroupCallRingCancellation(ringId: bigint): void;
  cleanExpiredGroupCallRingCancellations(): void;
};

// Adds a database argument
type AddReadonlyDB<I> = {
  [Key in keyof I]: I[Key] extends (...args: infer Args) => infer R
    ? (db: ReadableDB, ...args: Args) => R
    : never;
};

export type ServerReadableDirectInterface = ReadableInterface & {
  // Differing signature on client/server
  searchMessages: ({
    query,
    conversationId,
    options,
    contactServiceIdsMatchingQuery,
  }: {
    query: string;
    conversationId?: string;
    options?: { limit?: number };
    contactServiceIdsMatchingQuery?: Array<ServiceIdString>;
  }) => Array<ServerSearchResultMessageType>;

  getRecentStoryReplies(
    storyId: string,
    options?: GetRecentStoryRepliesOptionsType
  ): Array<MessageTypeUnhydrated>;
  getOlderMessagesByConversation: (
    options: AdjacentMessagesByConversationOptionsType
  ) => Array<MessageTypeUnhydrated>;
  getNewerMessagesByConversation: (
    options: AdjacentMessagesByConversationOptionsType
  ) => Array<MessageTypeUnhydrated>;
  getConversationRangeCenteredOnMessage: (
    options: AdjacentMessagesByConversationOptionsType
  ) => GetConversationRangeCenteredOnMessageResultType<MessageTypeUnhydrated>;

  getIdentityKeyById: (
    id: IdentityKeyIdType
  ) => StoredIdentityKeyType | undefined;
  getAllIdentityKeys: () => Array<StoredIdentityKeyType>;

  getKyberPreKeyById: (id: PreKeyIdType) => StoredKyberPreKeyType | undefined;
  getAllKyberPreKeys: () => Array<StoredKyberPreKeyType>;

  getPreKeyById: (id: PreKeyIdType) => StoredPreKeyType | undefined;
  getAllPreKeys: () => Array<StoredPreKeyType>;

  getSignedPreKeyById: (
    id: SignedPreKeyIdType
  ) => StoredSignedPreKeyType | undefined;
  getAllSignedPreKeys: () => Array<StoredSignedPreKeyType>;

  getItemById<K extends ItemKeyType>(id: K): StoredItemType<K> | undefined;
  getAllItems: () => StoredAllItemsType;

  // Server-only

  getKnownMessageAttachments: (
    cursor?: MessageAttachmentsCursorType
  ) => GetKnownMessageAttachmentsResultType;
  finishGetKnownMessageAttachments: (
    cursor: MessageAttachmentsCursorType
  ) => void;
  getKnownDownloads: () => Array<string>;
  getKnownConversationAttachments: () => Array<string>;

  getAllBadgeImageFileLocalPaths: () => Set<string>;
};
export type ServerReadableInterface =
  AddReadonlyDB<ServerReadableDirectInterface>;

// Adds a database argument
type AddWritableDB<I> = {
  [Key in keyof I]: I[Key] extends (...args: infer Args) => infer R
    ? (db: WritableDB, ...args: Args) => R
    : never;
};

export type ServerWritableDirectInterface = WritableInterface & {
  // Differing signature on client/server

  updateConversation: (data: ConversationType) => void;
  removeConversation: (id: Array<string> | string) => void;

  saveMessage: (
    data: ReadonlyDeep<MessageType>,
    options: {
      jobToInsert?: StoredJob;
      forceSave?: boolean;
      ourAci: AciString;
    }
  ) => string;
  saveMessages: (
    arrayOfMessages: ReadonlyArray<ReadonlyDeep<MessageType>>,
    options: { forceSave?: boolean; ourAci: AciString }
  ) => Array<string>;
  saveMessagesIndividually: (
    arrayOfMessages: ReadonlyArray<ReadonlyDeep<MessageType>>,
    options: { forceSave?: boolean; ourAci: AciString }
  ) => { failedIndices: Array<number> };
  removeMessage: (id: string) => void;
  removeMessages: (ids: ReadonlyArray<string>) => void;

  createOrUpdateIdentityKey: (data: StoredIdentityKeyType) => void;
  bulkAddIdentityKeys: (array: Array<StoredIdentityKeyType>) => void;

  createOrUpdateKyberPreKey: (data: StoredKyberPreKeyType) => void;
  bulkAddKyberPreKeys: (array: Array<StoredKyberPreKeyType>) => void;

  createOrUpdatePreKey: (data: StoredPreKeyType) => void;
  bulkAddPreKeys: (array: Array<StoredPreKeyType>) => void;

  createOrUpdateSignedPreKey: (data: StoredSignedPreKeyType) => void;
  bulkAddSignedPreKeys: (array: Array<StoredSignedPreKeyType>) => void;

  createOrUpdateItem<K extends ItemKeyType>(data: StoredItemType<K>): void;

  // Server-only

  removeKnownStickers: (allStickers: ReadonlyArray<string>) => Array<string>;
  removeKnownDraftAttachments: (
    allStickers: ReadonlyArray<string>
  ) => Array<string>;

  runCorruptionChecks: () => boolean;
};

export type ServerWritableInterface =
  AddWritableDB<ServerWritableDirectInterface>;

// Makes sync calls - async
export type ClientInterfaceWrap<I> = {
  [Key in keyof I]: I[Key] extends (...args: infer Args) => infer R
    ? (...args: Args) => Promise<R>
    : never;
};

export type ClientOnlyReadableInterface = ClientInterfaceWrap<{
  // Differing signature on client/server
  searchMessages: ({
    query,
    conversationId,
    options,
    contactServiceIdsMatchingQuery,
  }: {
    query: string;
    conversationId?: string;
    options?: { limit?: number };
    contactServiceIdsMatchingQuery?: Array<ServiceIdString>;
  }) => Array<ClientSearchResultMessageType>;

  getRecentStoryReplies(
    storyId: string,
    options?: GetRecentStoryRepliesOptionsType
  ): Array<MessageType>;
  getOlderMessagesByConversation: (
    options: AdjacentMessagesByConversationOptionsType
  ) => Array<MessageType>;
  getNewerMessagesByConversation: (
    options: AdjacentMessagesByConversationOptionsType
  ) => Array<MessageType>;
  getConversationRangeCenteredOnMessage: (
    options: AdjacentMessagesByConversationOptionsType
  ) => GetConversationRangeCenteredOnMessageResultType<MessageType>;

  getIdentityKeyById: (id: IdentityKeyIdType) => IdentityKeyType | undefined;
  getAllIdentityKeys: () => Array<IdentityKeyType>;

  getKyberPreKeyById: (id: PreKeyIdType) => KyberPreKeyType | undefined;
  getAllKyberPreKeys: () => Array<KyberPreKeyType>;

  getPreKeyById: (id: PreKeyIdType) => PreKeyType | undefined;
  getAllPreKeys: () => Array<PreKeyType>;

  getSignedPreKeyById: (id: SignedPreKeyIdType) => SignedPreKeyType | undefined;
  getAllSignedPreKeys: () => Array<SignedPreKeyType>;

  getItemById<K extends ItemKeyType>(id: K): ItemType<K> | undefined;
  getAllItems: () => AllItemsType;
}>;

export type ClientOnlyWritableInterface = ClientInterfaceWrap<{
  // Differing signature on client/server
  updateConversation: (data: ConversationType) => void;
  removeConversation: (id: string) => void;
  flushUpdateConversationBatcher: () => void;

  saveMessage: (
    data: ReadonlyDeep<MessageType>,
    options: {
      jobToInsert?: StoredJob;
      forceSave?: boolean;
      ourAci: AciString;
      postSaveUpdates: () => Promise<void>;
    }
  ) => string;
  saveMessages: (
    arrayOfMessages: ReadonlyArray<ReadonlyDeep<MessageType>>,
    options: {
      forceSave?: boolean;
      ourAci: AciString;
      postSaveUpdates: () => Promise<void>;
    }
  ) => Array<string>;
  saveMessagesIndividually: (
    arrayOfMessages: ReadonlyArray<ReadonlyDeep<MessageType>>,
    options: {
      forceSave?: boolean;
      ourAci: AciString;
      postSaveUpdates: () => Promise<void>;
    }
  ) => { failedIndices: Array<number> };
  removeMessage: (
    id: string,
    options: {
      fromSync?: boolean;
      cleanupMessages: (
        messages: ReadonlyArray<MessageAttributesType>,
        options: { fromSync?: boolean | undefined }
      ) => Promise<void>;
    }
  ) => void;
  removeMessages: (
    ids: ReadonlyArray<string>,
    options: {
      fromSync?: boolean;
      cleanupMessages: (
        messages: ReadonlyArray<MessageAttributesType>,
        options: { fromSync?: boolean | undefined }
      ) => Promise<void>;
    }
  ) => void;

  createOrUpdateIdentityKey: (data: IdentityKeyType) => void;
  bulkAddIdentityKeys: (array: Array<IdentityKeyType>) => void;

  createOrUpdateKyberPreKey: (data: KyberPreKeyType) => void;
  bulkAddKyberPreKeys: (array: Array<KyberPreKeyType>) => void;

  createOrUpdatePreKey: (data: PreKeyType) => void;
  bulkAddPreKeys: (array: Array<PreKeyType>) => void;

  createOrUpdateSignedPreKey: (data: SignedPreKeyType) => void;
  bulkAddSignedPreKeys: (array: Array<SignedPreKeyType>) => void;

  createOrUpdateItem<K extends ItemKeyType>(data: ItemType<K>): void;

  // Client-side only

  shutdown: () => void;
  removeDB: () => void;
  removeMessagesInConversation: (
    conversationId: string,
    options: {
      cleanupMessages: (
        messages: ReadonlyArray<MessageAttributesType>,
        options: { fromSync?: boolean | undefined }
      ) => Promise<void>;
      fromSync?: boolean;
      logId: string;
      receivedAt?: number;
    }
  ) => void;
  removeOtherData: () => void;
  cleanupOrphanedAttachments: () => void;
  ensureFilePermissions: () => void;
}>;

export type ClientReadableInterface = ClientInterfaceWrap<ReadableInterface> &
  ClientOnlyReadableInterface;
export type ClientWritableInterface = ClientInterfaceWrap<WritableInterface> &
  ClientOnlyWritableInterface;
