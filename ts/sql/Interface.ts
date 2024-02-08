// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ConversationAttributesType,
  MessageAttributesType,
  SenderKeyInfoType,
} from '../model-types.d';
import type { StoredJob } from '../jobs/types';
import type { ReactionType, ReactionReadStatus } from '../types/Reactions';
import type { ConversationColorType, CustomColorType } from '../types/Colors';
import type { StorageAccessType } from '../types/Storage.d';
import type { AttachmentType } from '../types/Attachment';
import type { BytesToStrings } from '../types/Util';
import type { QualifiedAddressStringType } from '../types/QualifiedAddress';
import type { StoryDistributionIdString } from '../types/StoryDistributionId';
import type { AciString, PniString, ServiceIdString } from '../types/ServiceId';
import type { BadgeType } from '../badges/types';
import type { LoggerType } from '../types/Logging';
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
} from '../types/CallDisposition';

export type AdjacentMessagesByConversationOptionsType = Readonly<{
  conversationId: string;
  messageId?: string;
  includeStoryReplies: boolean;
  limit?: number;
  receivedAt?: number;
  sentAt?: number;
  storyId: string | undefined;
  requireVisualMediaAttachments?: boolean;
}>;

export type GetNearbyMessageFromDeletedSetOptionsType = Readonly<{
  conversationId: string;
  lastSelectedMessage: MessageTimestamps;
  deletedMessageIds: ReadonlyArray<string>;
  storyId: string | undefined;
  includeStoryReplies: boolean;
}>;

export type AttachmentDownloadJobTypeType =
  | 'long-message'
  | 'attachment'
  | 'preview'
  | 'contact'
  | 'quote'
  | 'sticker';

export type AttachmentDownloadJobType = {
  attachment: AttachmentType;
  attempts: number;
  id: string;
  index: number;
  messageId: string;
  pending: number;
  timestamp: number;
  type: AttachmentDownloadJobTypeType;
};
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
export type MessageTypeUnhydrated = {
  json: string;
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
export type ServerSearchResultMessageType = {
  json: string;

  // If the FTS matches text in message.body, snippet will be populated
  ftsSnippet: string | null;

  // Otherwise, a matching mention will be returned
  mentionAci: string | null;
  mentionStart: number | null;
  mentionLength: number | null;
};
export type ClientSearchResultMessageType = MessageType & {
  json: string;
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
  record: string;
  version?: number;
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
}>;

export const StickerPackStatuses = [
  'known',
  'ephemeral',
  'downloaded',
  'installed',
  'pending',
  'error',
] as const;

export type StickerPackStatusType = typeof StickerPackStatuses[number];

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

export type UnprocessedType = {
  id: string;
  timestamp: number;
  receivedAtCounter: number | null;
  version: number;
  attempts: number;
  envelope?: string;

  messageAgeSec?: number;
  source?: string;
  sourceServiceId?: ServiceIdString;
  sourceDevice?: number;
  destinationServiceId?: ServiceIdString;
  updatedPni?: PniString;
  serverGuid?: string;
  serverTimestamp?: number;
  decrypted?: string;
  urgent?: boolean;
  story?: boolean;
  reportingToken?: string;
};

export type UnprocessedUpdateType = {
  source?: string;
  sourceServiceId?: ServiceIdString;
  sourceDevice?: number;
  serverGuid?: string;
  serverTimestamp?: number;
  decrypted?: string;
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
  >
>;

export type GetConversationRangeCenteredOnMessageResultType<Message> =
  Readonly<{
    older: Array<Message>;
    newer: Array<Message>;
    metrics: ConversationMetricsType;
  }>;

export type MessageAttachmentsCursorType = Readonly<{
  done: boolean;
  runId: string;
  count: number;
}>;

export type GetKnownMessageAttachmentsResultType = Readonly<{
  cursor: MessageAttachmentsCursorType;
  attachments: ReadonlyArray<string>;
}>;

export type GetAllStoriesResultType = ReadonlyArray<
  MessageType & {
    hasReplies: boolean;
    hasRepliesFromSelf: boolean;
  }
>;

export type FTSOptimizationStateType = Readonly<{
  steps: number;
  done?: boolean;
}>;

export type EditedMessageType = Readonly<{
  conversationId: string;
  messageId: string;
  sentAt: number;
  readStatus: MessageType['readStatus'];
}>;

export type DataInterface = {
  close: () => Promise<void>;
  removeDB: () => Promise<void>;
  removeIndexedDBFiles: () => Promise<void>;

  removeIdentityKeyById: (id: IdentityKeyIdType) => Promise<number>;
  removeAllIdentityKeys: () => Promise<number>;

  removeKyberPreKeyById: (
    id: PreKeyIdType | Array<PreKeyIdType>
  ) => Promise<number>;
  removeKyberPreKeysByServiceId: (serviceId: ServiceIdString) => Promise<void>;
  removeAllKyberPreKeys: () => Promise<number>;

  removePreKeyById: (id: PreKeyIdType | Array<PreKeyIdType>) => Promise<number>;
  removePreKeysByServiceId: (serviceId: ServiceIdString) => Promise<void>;
  removeAllPreKeys: () => Promise<number>;

  removeSignedPreKeyById: (
    id: SignedPreKeyIdType | Array<SignedPreKeyIdType>
  ) => Promise<number>;
  removeSignedPreKeysByServiceId: (serviceId: ServiceIdString) => Promise<void>;
  removeAllSignedPreKeys: () => Promise<number>;

  removeAllItems: () => Promise<number>;
  removeItemById: (id: ItemKeyType | Array<ItemKeyType>) => Promise<number>;

  createOrUpdateSenderKey: (key: SenderKeyType) => Promise<void>;
  getSenderKeyById: (id: SenderKeyIdType) => Promise<SenderKeyType | undefined>;
  removeAllSenderKeys: () => Promise<void>;
  getAllSenderKeys: () => Promise<Array<SenderKeyType>>;
  removeSenderKeyById: (id: SenderKeyIdType) => Promise<void>;

  insertSentProto: (
    proto: SentProtoType,
    options: {
      recipients: SentRecipientsType;
      messageIds: SentMessagesType;
    }
  ) => Promise<number>;
  deleteSentProtosOlderThan: (timestamp: number) => Promise<void>;
  deleteSentProtoByMessageId: (messageId: string) => Promise<void>;
  insertProtoRecipients: (options: {
    id: number;
    recipientServiceId: ServiceIdString;
    deviceIds: Array<number>;
  }) => Promise<void>;
  deleteSentProtoRecipient: (
    options:
      | DeleteSentProtoRecipientOptionsType
      | ReadonlyArray<DeleteSentProtoRecipientOptionsType>
  ) => Promise<DeleteSentProtoRecipientResultType>;
  getSentProtoByRecipient: (options: {
    now: number;
    recipientServiceId: ServiceIdString;
    timestamp: number;
  }) => Promise<SentProtoWithMessageIdsType | undefined>;
  removeAllSentProtos: () => Promise<void>;
  getAllSentProtos: () => Promise<Array<SentProtoType>>;
  // Test-only
  _getAllSentProtoRecipients: () => Promise<Array<SentRecipientsDBType>>;
  _getAllSentProtoMessageIds: () => Promise<Array<SentMessageDBType>>;

  createOrUpdateSession: (data: SessionType) => Promise<void>;
  createOrUpdateSessions: (array: Array<SessionType>) => Promise<void>;
  commitDecryptResult(options: {
    senderKeys: Array<SenderKeyType>;
    sessions: Array<SessionType>;
    unprocessed: Array<UnprocessedType>;
  }): Promise<void>;
  bulkAddSessions: (array: Array<SessionType>) => Promise<void>;
  removeSessionById: (id: SessionIdType) => Promise<number>;
  removeSessionsByConversation: (conversationId: string) => Promise<void>;
  removeSessionsByServiceId: (serviceId: ServiceIdString) => Promise<void>;
  removeAllSessions: () => Promise<number>;
  getAllSessions: () => Promise<Array<SessionType>>;

  getConversationCount: () => Promise<number>;
  saveConversation: (data: ConversationType) => Promise<void>;
  saveConversations: (array: Array<ConversationType>) => Promise<void>;
  getConversationById: (id: string) => Promise<ConversationType | undefined>;
  // updateConversation is a normal data method on Server, a sync batch-add on Client
  updateConversations: (array: Array<ConversationType>) => Promise<void>;
  // removeConversation handles either one id or an array on Server, and one id on Client
  _removeAllConversations: () => Promise<void>;
  updateAllConversationColors: (
    conversationColor?: ConversationColorType,
    customColorData?: {
      id: string;
      value: CustomColorType;
    }
  ) => Promise<void>;
  removeAllProfileKeyCredentials: () => Promise<void>;

  getAllConversations: () => Promise<Array<ConversationType>>;
  getAllConversationIds: () => Promise<Array<string>>;
  getAllGroupsInvolvingServiceId: (
    serviceId: ServiceIdString
  ) => Promise<Array<ConversationType>>;

  getMessageCount: (conversationId?: string) => Promise<number>;
  getStoryCount: (conversationId: string) => Promise<number>;
  saveMessage: (
    data: MessageType,
    options: {
      jobToInsert?: StoredJob;
      forceSave?: boolean;
      ourAci: AciString;
    }
  ) => Promise<string>;
  saveMessages: (
    arrayOfMessages: ReadonlyArray<MessageType>,
    options: { forceSave?: boolean; ourAci: AciString }
  ) => Promise<void>;
  removeMessage: (id: string) => Promise<void>;
  removeMessages: (ids: ReadonlyArray<string>) => Promise<void>;
  getTotalUnreadForConversation: (
    conversationId: string,
    options: {
      storyId: string | undefined;
      includeStoryReplies: boolean;
    }
  ) => Promise<number>;
  getTotalUnreadMentionsOfMeForConversation: (
    conversationId: string,
    options: {
      storyId?: string;
      includeStoryReplies: boolean;
    }
  ) => Promise<number>;
  getOldestUnreadMentionOfMeForConversation(
    conversationId: string,
    options: {
      storyId?: string;
      includeStoryReplies: boolean;
    }
  ): Promise<MessageMetricsType | undefined>;
  getUnreadByConversationAndMarkRead: (options: {
    conversationId: string;
    includeStoryReplies: boolean;
    newestUnreadAt: number;
    now?: number;
    readAt?: number;
    storyId?: string;
  }) => Promise<GetUnreadByConversationAndMarkReadResultType>;
  getUnreadEditedMessagesAndMarkRead: (options: {
    conversationId: string;
    newestUnreadAt: number;
  }) => Promise<GetUnreadByConversationAndMarkReadResultType>;
  getUnreadReactionsAndMarkRead: (options: {
    conversationId: string;
    newestUnreadAt: number;
    storyId?: string;
  }) => Promise<Array<ReactionResultType>>;
  markReactionAsRead: (
    targetAuthorServiceId: ServiceIdString,
    targetTimestamp: number
  ) => Promise<ReactionType | undefined>;
  removeReactionFromConversation: (reaction: {
    emoji: string;
    fromId: string;
    targetAuthorServiceId: ServiceIdString;
    targetTimestamp: number;
  }) => Promise<void>;
  getReactionByTimestamp: (
    fromId: string,
    timestamp: number
  ) => Promise<ReactionType | undefined>;
  addReaction: (
    reactionObj: ReactionType,
    options: {
      readStatus: ReactionReadStatus;
    }
  ) => Promise<void>;
  _getAllReactions: () => Promise<Array<ReactionType>>;
  _removeAllReactions: () => Promise<void>;
  getMessageBySender: (options: {
    source?: string;
    sourceServiceId?: ServiceIdString;
    sourceDevice?: number;
    sent_at: number;
  }) => Promise<MessageType | undefined>;
  getMessageById: (id: string) => Promise<MessageType | undefined>;
  getMessagesById: (
    messageIds: ReadonlyArray<string>
  ) => Promise<Array<MessageType>>;
  _getAllMessages: () => Promise<Array<MessageType>>;
  _getAllEditedMessages: () => Promise<
    Array<{ messageId: string; sentAt: number }>
  >;
  _removeAllMessages: () => Promise<void>;
  getAllMessageIds: () => Promise<Array<string>>;
  getMessagesBySentAt: (sentAt: number) => Promise<Array<MessageType>>;
  getExpiredMessages: () => Promise<Array<MessageType>>;
  getMessagesUnexpectedlyMissingExpirationStartTimestamp: () => Promise<
    Array<MessageType>
  >;
  getSoonestMessageExpiry: () => Promise<undefined | number>;
  getNextTapToViewMessageTimestampToAgeOut: () => Promise<undefined | number>;
  getTapToViewMessagesNeedingErase: () => Promise<Array<MessageType>>;
  // getOlderMessagesByConversation is JSON on server, full message on Client
  getAllStories: (options: {
    conversationId?: string;
    sourceServiceId?: ServiceIdString;
  }) => Promise<GetAllStoriesResultType>;
  // getNewerMessagesByConversation is JSON on server, full message on Client
  getMessageMetricsForConversation: (options: {
    conversationId: string;
    storyId?: string;
    includeStoryReplies: boolean;
  }) => Promise<ConversationMetricsType>;
  // getConversationRangeCenteredOnMessage is JSON on server, full message on client
  getConversationMessageStats: (options: {
    conversationId: string;
    includeStoryReplies: boolean;
  }) => Promise<ConversationMessageStatsType>;
  getLastConversationMessage(options: {
    conversationId: string;
  }): Promise<MessageType | undefined>;
  getAllCallHistory: () => Promise<ReadonlyArray<CallHistoryDetails>>;
  clearCallHistory: (beforeTimestamp: number) => Promise<Array<string>>;
  cleanupCallHistoryMessages: () => Promise<void>;
  getCallHistoryUnreadCount(): Promise<number>;
  markCallHistoryRead(callId: string): Promise<void>;
  markAllCallHistoryRead(): Promise<ReadonlyArray<string>>;
  getCallHistoryMessageByCallId(options: {
    conversationId: string;
    callId: string;
  }): Promise<MessageType | undefined>;
  getCallHistory(
    callId: string,
    peerId: ServiceIdString | string
  ): Promise<CallHistoryDetails | undefined>;
  getCallHistoryGroupsCount(filter: CallHistoryFilter): Promise<number>;
  getCallHistoryGroups(
    filter: CallHistoryFilter,
    pagination: CallHistoryPagination
  ): Promise<Array<CallHistoryGroup>>;
  saveCallHistory(callHistory: CallHistoryDetails): Promise<void>;
  hasGroupCallHistoryMessage: (
    conversationId: string,
    eraId: string
  ) => Promise<boolean>;
  markCallHistoryMissed(callIds: ReadonlyArray<string>): Promise<void>;
  getRecentStaleRingsAndMarkOlderMissed(): Promise<
    ReadonlyArray<MaybeStaleCallHistory>
  >;
  migrateConversationMessages: (
    obsoleteId: string,
    currentId: string
  ) => Promise<void>;
  getMessagesBetween: (
    conversationId: string,
    options: GetMessagesBetweenOptions
  ) => Promise<Array<string>>;
  getNearbyMessageFromDeletedSet: (
    options: GetNearbyMessageFromDeletedSetOptionsType
  ) => Promise<string | null>;
  saveEditedMessage: (
    mainMessage: MessageType,
    ourAci: AciString,
    opts: EditedMessageType
  ) => Promise<void>;
  getUnprocessedCount: () => Promise<number>;
  getUnprocessedByIdsAndIncrementAttempts: (
    ids: ReadonlyArray<string>
  ) => Promise<Array<UnprocessedType>>;
  getAllUnprocessedIds: () => Promise<Array<string>>;
  updateUnprocessedWithData: (
    id: string,
    data: UnprocessedUpdateType
  ) => Promise<void>;
  updateUnprocessedsWithData: (
    array: Array<{ id: string; data: UnprocessedUpdateType }>
  ) => Promise<void>;
  getUnprocessedById: (id: string) => Promise<UnprocessedType | undefined>;
  removeUnprocessed: (id: string | Array<string>) => Promise<void>;

  /** only for testing */
  removeAllUnprocessed: () => Promise<void>;

  getAttachmentDownloadJobById: (
    id: string
  ) => Promise<AttachmentDownloadJobType | undefined>;
  getNextAttachmentDownloadJobs: (
    limit?: number,
    options?: { timestamp?: number }
  ) => Promise<Array<AttachmentDownloadJobType>>;
  saveAttachmentDownloadJob: (job: AttachmentDownloadJobType) => Promise<void>;
  resetAttachmentDownloadPending: () => Promise<void>;
  setAttachmentDownloadJobPending: (
    id: string,
    pending: boolean
  ) => Promise<void>;
  removeAttachmentDownloadJob: (id: string) => Promise<number>;
  removeAllAttachmentDownloadJobs: () => Promise<number>;

  createOrUpdateStickerPack: (pack: StickerPackType) => Promise<void>;
  updateStickerPackStatus: (
    id: string,
    status: StickerPackStatusType,
    options?: { timestamp: number }
  ) => Promise<void>;
  updateStickerPackInfo: (info: StickerPackInfoType) => Promise<void>;
  createOrUpdateSticker: (sticker: StickerType) => Promise<void>;
  updateStickerLastUsed: (
    packId: string,
    stickerId: number,
    lastUsed: number
  ) => Promise<void>;
  addStickerPackReference: (messageId: string, packId: string) => Promise<void>;
  deleteStickerPackReference: (
    messageId: string,
    packId: string
  ) => Promise<ReadonlyArray<string> | undefined>;
  getStickerCount: () => Promise<number>;
  deleteStickerPack: (packId: string) => Promise<Array<string>>;
  getAllStickerPacks: () => Promise<Array<StickerPackType>>;
  addUninstalledStickerPack: (
    pack: UninstalledStickerPackType
  ) => Promise<void>;
  removeUninstalledStickerPack: (packId: string) => Promise<void>;
  getInstalledStickerPacks: () => Promise<Array<StickerPackType>>;
  getUninstalledStickerPacks: () => Promise<Array<UninstalledStickerPackType>>;
  installStickerPack: (packId: string, timestamp: number) => Promise<void>;
  uninstallStickerPack: (packId: string, timestamp: number) => Promise<void>;
  getStickerPackInfo: (
    packId: string
  ) => Promise<StickerPackInfoType | undefined>;
  getAllStickers: () => Promise<Array<StickerType>>;
  getRecentStickers: (options?: {
    limit?: number;
  }) => Promise<Array<StickerType>>;
  clearAllErrorStickerPackAttempts: () => Promise<void>;

  updateEmojiUsage: (shortName: string, timeUsed?: number) => Promise<void>;
  getRecentEmojis: (limit?: number) => Promise<Array<EmojiType>>;

  getAllBadges(): Promise<Array<BadgeType>>;
  updateOrCreateBadges(badges: ReadonlyArray<BadgeType>): Promise<void>;
  badgeImageFileDownloaded(url: string, localPath: string): Promise<void>;

  _getAllStoryDistributions(): Promise<Array<StoryDistributionType>>;
  _getAllStoryDistributionMembers(): Promise<
    Array<StoryDistributionMemberType>
  >;
  _deleteAllStoryDistributions(): Promise<void>;
  createNewStoryDistribution(
    distribution: StoryDistributionWithMembersType
  ): Promise<void>;
  getAllStoryDistributionsWithMembers(): Promise<
    Array<StoryDistributionWithMembersType>
  >;
  getStoryDistributionWithMembers(
    id: string
  ): Promise<StoryDistributionWithMembersType | undefined>;
  modifyStoryDistribution(distribution: StoryDistributionType): Promise<void>;
  modifyStoryDistributionMembers(
    listId: string,
    options: {
      toAdd: Array<ServiceIdString>;
      toRemove: Array<ServiceIdString>;
    }
  ): Promise<void>;
  modifyStoryDistributionWithMembers(
    distribution: StoryDistributionType,
    options: {
      toAdd: Array<ServiceIdString>;
      toRemove: Array<ServiceIdString>;
    }
  ): Promise<void>;
  deleteStoryDistribution(id: StoryDistributionIdString): Promise<void>;

  _getAllStoryReads(): Promise<Array<StoryReadType>>;
  _deleteAllStoryReads(): Promise<void>;
  addNewStoryRead(read: StoryReadType): Promise<void>;
  getLastStoryReadsForAuthor(options: {
    authorId: ServiceIdString;
    conversationId?: string;
    limit?: number;
  }): Promise<Array<StoryReadType>>;
  countStoryReadsByConversation(conversationId: string): Promise<number>;

  removeAll: () => Promise<void>;
  removeAllConfiguration: () => Promise<void>;
  eraseStorageServiceState: () => Promise<void>;

  getMessagesNeedingUpgrade: (
    limit: number,
    options: { maxVersion: number }
  ) => Promise<Array<MessageType>>;
  getMessagesWithVisualMediaAttachments: (
    conversationId: string,
    options: { limit: number }
  ) => Promise<Array<MessageType>>;
  getMessagesWithFileAttachments: (
    conversationId: string,
    options: { limit: number }
  ) => Promise<Array<MessageType>>;
  getMessageServerGuidsForSpam: (
    conversationId: string
  ) => Promise<Array<string>>;

  getJobsInQueue(queueType: string): Promise<Array<StoredJob>>;
  insertJob(job: Readonly<StoredJob>): Promise<void>;
  deleteJob(id: string): Promise<void>;

  wasGroupCallRingPreviouslyCanceled(ringId: bigint): Promise<boolean>;
  processGroupCallRingCancellation(ringId: bigint): Promise<void>;
  cleanExpiredGroupCallRingCancellations(): Promise<void>;

  getMaxMessageCounter(): Promise<number | undefined>;

  getStatisticsForLogging(): Promise<Record<string, string>>;

  optimizeFTS: (
    state?: FTSOptimizationStateType
  ) => Promise<FTSOptimizationStateType | undefined>;
};

export type ServerInterface = DataInterface & {
  // Differing signature on client/server

  updateConversation: (data: ConversationType) => Promise<void>;
  removeConversation: (id: Array<string> | string) => Promise<void>;

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
  }) => Promise<Array<ServerSearchResultMessageType>>;

  getRecentStoryReplies(
    storyId: string,
    options?: GetRecentStoryRepliesOptionsType
  ): Promise<Array<MessageTypeUnhydrated>>;
  getOlderMessagesByConversation: (
    options: AdjacentMessagesByConversationOptionsType
  ) => Promise<Array<MessageTypeUnhydrated>>;
  getNewerMessagesByConversation: (
    options: AdjacentMessagesByConversationOptionsType
  ) => Promise<Array<MessageTypeUnhydrated>>;
  getConversationRangeCenteredOnMessage: (
    options: AdjacentMessagesByConversationOptionsType
  ) => Promise<
    GetConversationRangeCenteredOnMessageResultType<MessageTypeUnhydrated>
  >;

  createOrUpdateIdentityKey: (data: StoredIdentityKeyType) => Promise<void>;
  getIdentityKeyById: (
    id: IdentityKeyIdType
  ) => Promise<StoredIdentityKeyType | undefined>;
  bulkAddIdentityKeys: (array: Array<StoredIdentityKeyType>) => Promise<void>;
  getAllIdentityKeys: () => Promise<Array<StoredIdentityKeyType>>;

  createOrUpdateKyberPreKey: (data: StoredKyberPreKeyType) => Promise<void>;
  getKyberPreKeyById: (
    id: PreKeyIdType
  ) => Promise<StoredKyberPreKeyType | undefined>;
  bulkAddKyberPreKeys: (array: Array<StoredKyberPreKeyType>) => Promise<void>;
  getAllKyberPreKeys: () => Promise<Array<StoredKyberPreKeyType>>;

  createOrUpdatePreKey: (data: StoredPreKeyType) => Promise<void>;
  getPreKeyById: (id: PreKeyIdType) => Promise<StoredPreKeyType | undefined>;
  bulkAddPreKeys: (array: Array<StoredPreKeyType>) => Promise<void>;
  getAllPreKeys: () => Promise<Array<StoredPreKeyType>>;

  createOrUpdateSignedPreKey: (data: StoredSignedPreKeyType) => Promise<void>;
  getSignedPreKeyById: (
    id: SignedPreKeyIdType
  ) => Promise<StoredSignedPreKeyType | undefined>;
  bulkAddSignedPreKeys: (array: Array<StoredSignedPreKeyType>) => Promise<void>;
  getAllSignedPreKeys: () => Promise<Array<StoredSignedPreKeyType>>;

  createOrUpdateItem<K extends ItemKeyType>(
    data: StoredItemType<K>
  ): Promise<void>;
  getItemById<K extends ItemKeyType>(
    id: K
  ): Promise<StoredItemType<K> | undefined>;
  getAllItems: () => Promise<StoredAllItemsType>;

  // Server-only

  initialize: (options: {
    appVersion: string;
    configDir: string;
    key: string;
    logger: LoggerType;
  }) => Promise<void>;

  getKnownMessageAttachments: (
    cursor?: MessageAttachmentsCursorType
  ) => Promise<GetKnownMessageAttachmentsResultType>;
  finishGetKnownMessageAttachments: (
    cursor: MessageAttachmentsCursorType
  ) => Promise<void>;
  getKnownConversationAttachments: () => Promise<Array<string>>;
  removeKnownStickers: (
    allStickers: ReadonlyArray<string>
  ) => Promise<Array<string>>;
  removeKnownDraftAttachments: (
    allStickers: ReadonlyArray<string>
  ) => Promise<Array<string>>;
  getAllBadgeImageFileLocalPaths: () => Promise<Set<string>>;

  runCorruptionChecks: () => void;
};

export type GetRecentStoryRepliesOptionsType = {
  limit?: number;
  messageId?: string;
  receivedAt?: number;
  sentAt?: number;
};

// Differing signature on client/server
export type ClientExclusiveInterface = {
  // Differing signature on client/server

  updateConversation: (data: ConversationType) => void;
  removeConversation: (id: string) => Promise<void>;
  flushUpdateConversationBatcher: () => Promise<void>;

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
  }) => Promise<Array<ClientSearchResultMessageType>>;

  getRecentStoryReplies(
    storyId: string,
    options?: GetRecentStoryRepliesOptionsType
  ): Promise<Array<MessageAttributesType>>;
  getOlderMessagesByConversation: (
    options: AdjacentMessagesByConversationOptionsType
  ) => Promise<Array<MessageAttributesType>>;
  getNewerMessagesByConversation: (
    options: AdjacentMessagesByConversationOptionsType
  ) => Promise<Array<MessageAttributesType>>;
  getConversationRangeCenteredOnMessage: (
    options: AdjacentMessagesByConversationOptionsType
  ) => Promise<GetConversationRangeCenteredOnMessageResultType<MessageType>>;

  createOrUpdateIdentityKey: (data: IdentityKeyType) => Promise<void>;
  getIdentityKeyById: (
    id: IdentityKeyIdType
  ) => Promise<IdentityKeyType | undefined>;
  bulkAddIdentityKeys: (array: Array<IdentityKeyType>) => Promise<void>;
  getAllIdentityKeys: () => Promise<Array<IdentityKeyType>>;

  createOrUpdateKyberPreKey: (data: KyberPreKeyType) => Promise<void>;
  getKyberPreKeyById: (
    id: PreKeyIdType
  ) => Promise<KyberPreKeyType | undefined>;
  bulkAddKyberPreKeys: (array: Array<KyberPreKeyType>) => Promise<void>;
  getAllKyberPreKeys: () => Promise<Array<KyberPreKeyType>>;

  createOrUpdatePreKey: (data: PreKeyType) => Promise<void>;
  getPreKeyById: (id: PreKeyIdType) => Promise<PreKeyType | undefined>;
  bulkAddPreKeys: (array: Array<PreKeyType>) => Promise<void>;
  getAllPreKeys: () => Promise<Array<PreKeyType>>;

  createOrUpdateSignedPreKey: (data: SignedPreKeyType) => Promise<void>;
  getSignedPreKeyById: (
    id: SignedPreKeyIdType
  ) => Promise<SignedPreKeyType | undefined>;
  bulkAddSignedPreKeys: (array: Array<SignedPreKeyType>) => Promise<void>;
  getAllSignedPreKeys: () => Promise<Array<SignedPreKeyType>>;

  createOrUpdateItem<K extends ItemKeyType>(data: ItemType<K>): Promise<void>;
  getItemById<K extends ItemKeyType>(id: K): Promise<ItemType<K> | undefined>;
  getAllItems: () => Promise<AllItemsType>;

  // Client-side only

  shutdown: () => Promise<void>;
  removeAllMessagesInConversation: (
    conversationId: string,
    options: {
      logId: string;
    }
  ) => Promise<void>;
  removeOtherData: () => Promise<void>;
  cleanupOrphanedAttachments: () => Promise<void>;
  ensureFilePermissions: () => Promise<void>;
};

export type ClientInterface = DataInterface & ClientExclusiveInterface;
