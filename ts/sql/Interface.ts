// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { LocaleMessagesType } from '../types/I18N';

import {
  ConversationModelCollectionType,
  MessageModelCollectionType,
} from '../model-types.d';
import { MessageModel } from '../models/messages';
import { ConversationModel } from '../models/conversations';

export type AttachmentDownloadJobType = any;
export type ConverationMetricsType = any;
export type ConversationType = any;
export type EmojiType = any;
export type IdentityKeyType = any;
export type ItemType = any;
export type MessageType = any;
export type MessageTypeUnhydrated = any;
export type PreKeyType = any;
export type SearchResultMessageType = any;
export type SessionType = any;
export type SignedPreKeyType = any;
export type StickerPackStatusType = string;
export type StickerPackType = any;
export type StickerType = any;
export type UnprocessedType = any;

export type DataInterface = {
  close: () => Promise<void>;
  removeDB: () => Promise<void>;
  removeIndexedDBFiles: () => Promise<void>;

  createOrUpdateIdentityKey: (data: IdentityKeyType) => Promise<void>;
  getIdentityKeyById: (id: string) => Promise<IdentityKeyType | undefined>;
  bulkAddIdentityKeys: (array: Array<IdentityKeyType>) => Promise<void>;
  removeIdentityKeyById: (id: string) => Promise<void>;
  removeAllIdentityKeys: () => Promise<void>;
  getAllIdentityKeys: () => Promise<Array<IdentityKeyType>>;

  createOrUpdatePreKey: (data: PreKeyType) => Promise<void>;
  getPreKeyById: (id: number) => Promise<PreKeyType | undefined>;
  bulkAddPreKeys: (array: Array<PreKeyType>) => Promise<void>;
  removePreKeyById: (id: number) => Promise<void>;
  removeAllPreKeys: () => Promise<void>;
  getAllPreKeys: () => Promise<Array<PreKeyType>>;

  createOrUpdateSignedPreKey: (data: SignedPreKeyType) => Promise<void>;
  getSignedPreKeyById: (id: number) => Promise<SignedPreKeyType | undefined>;
  bulkAddSignedPreKeys: (array: Array<SignedPreKeyType>) => Promise<void>;
  removeSignedPreKeyById: (id: number) => Promise<void>;
  removeAllSignedPreKeys: () => Promise<void>;
  getAllSignedPreKeys: () => Promise<Array<SignedPreKeyType>>;

  createOrUpdateItem: (data: ItemType) => Promise<void>;
  getItemById: (id: string) => Promise<ItemType | undefined>;
  bulkAddItems: (array: Array<ItemType>) => Promise<void>;
  removeItemById: (id: string) => Promise<void>;
  removeAllItems: () => Promise<void>;
  getAllItems: () => Promise<Array<ItemType>>;

  createOrUpdateSession: (data: SessionType) => Promise<void>;
  createOrUpdateSessions: (array: Array<SessionType>) => Promise<void>;
  getSessionById: (id: string) => Promise<SessionType | undefined>;
  getSessionsById: (conversationId: string) => Promise<Array<SessionType>>;
  bulkAddSessions: (array: Array<SessionType>) => Promise<void>;
  removeSessionById: (id: string) => Promise<void>;
  removeSessionsByConversation: (conversationId: string) => Promise<void>;
  removeAllSessions: () => Promise<void>;
  getAllSessions: () => Promise<Array<SessionType>>;

  eraseStorageServiceStateFromConversations: () => Promise<void>;
  getConversationCount: () => Promise<number>;
  saveConversation: (data: ConversationType) => Promise<void>;
  saveConversations: (array: Array<ConversationType>) => Promise<void>;
  updateConversations: (array: Array<ConversationType>) => Promise<void>;
  getAllConversationIds: () => Promise<Array<string>>;

  searchConversations: (
    query: string,
    options?: { limit?: number }
  ) => Promise<Array<ConversationType>>;
  searchMessages: (
    query: string,
    options?: { limit?: number }
  ) => Promise<Array<SearchResultMessageType>>;
  searchMessagesInConversation: (
    query: string,
    conversationId: string,
    options?: { limit?: number }
  ) => Promise<Array<SearchResultMessageType>>;

  getMessageCount: (conversationId?: string) => Promise<number>;
  saveMessages: (
    arrayOfMessages: Array<MessageType>,
    options: { forceSave?: boolean }
  ) => Promise<void>;
  getAllMessageIds: () => Promise<Array<string>>;
  getMessageMetricsForConversation: (
    conversationId: string
  ) => Promise<ConverationMetricsType>;
  hasGroupCallHistoryMessage: (
    conversationId: string,
    eraId: string
  ) => Promise<boolean>;
  migrateConversationMessages: (
    obsoleteId: string,
    currentId: string
  ) => Promise<void>;

  getUnprocessedCount: () => Promise<number>;
  getAllUnprocessed: () => Promise<Array<UnprocessedType>>;
  saveUnprocessed: (
    data: UnprocessedType,
    options?: { forceSave?: boolean }
  ) => Promise<number>;
  updateUnprocessedAttempts: (id: string, attempts: number) => Promise<void>;
  updateUnprocessedWithData: (
    id: string,
    data: UnprocessedType
  ) => Promise<void>;
  updateUnprocessedsWithData: (array: Array<UnprocessedType>) => Promise<void>;
  getUnprocessedById: (id: string) => Promise<UnprocessedType | undefined>;
  saveUnprocesseds: (
    arrayOfUnprocessed: Array<UnprocessedType>,
    options?: { forceSave?: boolean }
  ) => Promise<void>;
  removeUnprocessed: (id: string | Array<string>) => Promise<void>;
  removeAllUnprocessed: () => Promise<void>;

  getNextAttachmentDownloadJobs: (
    limit?: number,
    options?: { timestamp?: number }
  ) => Promise<Array<AttachmentDownloadJobType>>;
  saveAttachmentDownloadJob: (job: AttachmentDownloadJobType) => Promise<void>;
  setAttachmentDownloadJobPending: (
    id: string,
    pending: boolean
  ) => Promise<void>;
  resetAttachmentDownloadPending: () => Promise<void>;
  removeAttachmentDownloadJob: (id: string) => Promise<void>;
  removeAllAttachmentDownloadJobs: () => Promise<void>;

  createOrUpdateStickerPack: (pack: StickerPackType) => Promise<void>;
  updateStickerPackStatus: (
    id: string,
    status: StickerPackStatusType,
    options?: { timestamp: number }
  ) => Promise<void>;
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
  ) => Promise<Array<string>>;
  getStickerCount: () => Promise<number>;
  deleteStickerPack: (packId: string) => Promise<Array<string>>;
  getAllStickerPacks: () => Promise<Array<StickerPackType>>;
  getAllStickers: () => Promise<Array<StickerType>>;
  getRecentStickers: (options?: {
    limit?: number;
  }) => Promise<Array<StickerType>>;
  clearAllErrorStickerPackAttempts: () => Promise<void>;

  updateEmojiUsage: (shortName: string, timeUsed?: number) => Promise<void>;
  getRecentEmojis: (limit?: number) => Promise<Array<EmojiType>>;

  removeAll: () => Promise<void>;
  removeAllConfiguration: () => Promise<void>;

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
};

// The reason for client/server divergence is the need to inject Backbone models and
//   collections into data calls so those are the objects returned. This was necessary in
//   July 2018 when creating the Data API as a drop-in replacement for previous database
//   requests via ORM.

// Note: It is extremely important that items are duplicated between these two. Client.js
//   loops over all of its local functions to generate the server-side IPC-based API.

export type ServerInterface = DataInterface & {
  getAllConversations: () => Promise<Array<ConversationType>>;
  getAllGroupsInvolvingId: (id: string) => Promise<Array<ConversationType>>;
  getAllPrivateConversations: () => Promise<Array<ConversationType>>;
  getConversationById: (id: string) => Promise<ConversationType | null>;
  getExpiredMessages: () => Promise<Array<MessageType>>;
  getMessageById: (id: string) => Promise<MessageType | undefined>;
  getMessageBySender: (options: {
    source: string;
    sourceUuid: string;
    sourceDevice: string;
    sent_at: number;
  }) => Promise<Array<MessageType>>;
  getMessagesBySentAt: (sentAt: number) => Promise<Array<MessageType>>;
  getOlderMessagesByConversation: (
    conversationId: string,
    options?: {
      limit?: number;
      receivedAt?: number;
      sentAt?: number;
      messageId?: string;
    }
  ) => Promise<Array<MessageTypeUnhydrated>>;
  getNewerMessagesByConversation: (
    conversationId: string,
    options?: { limit?: number; receivedAt?: number; sentAt?: number }
  ) => Promise<Array<MessageTypeUnhydrated>>;
  getLastConversationActivity: (options: {
    conversationId: string;
    ourConversationId: string;
  }) => Promise<MessageType | undefined>;
  getLastConversationPreview: (options: {
    conversationId: string;
    ourConversationId: string;
  }) => Promise<MessageType | undefined>;
  getNextExpiringMessage: () => Promise<MessageType>;
  getNextTapToViewMessageToAgeOut: () => Promise<MessageType>;
  getOutgoingWithoutExpiresAt: () => Promise<Array<MessageType>>;
  getTapToViewMessagesNeedingErase: () => Promise<Array<MessageType>>;
  getUnreadByConversation: (
    conversationId: string
  ) => Promise<Array<MessageType>>;
  removeConversation: (id: Array<string> | string) => Promise<void>;
  removeMessage: (id: string) => Promise<void>;
  removeMessages: (ids: Array<string>) => Promise<void>;
  saveMessage: (
    data: MessageType,
    options: { forceSave?: boolean }
  ) => Promise<string>;
  updateConversation: (data: ConversationType) => Promise<void>;

  // For testing only
  _getAllMessages: () => Promise<Array<MessageType>>;

  // Server-only

  initialize: (options: {
    configDir: string;
    key: string;
    messages: LocaleMessagesType;
  }) => Promise<void>;

  initializeRenderer: (options: {
    configDir: string;
    key: string;
  }) => Promise<void>;

  removeKnownAttachments: (
    allAttachments: Array<string>
  ) => Promise<Array<string>>;
  removeKnownStickers: (allStickers: Array<string>) => Promise<Array<string>>;
  removeKnownDraftAttachments: (
    allStickers: Array<string>
  ) => Promise<Array<string>>;
};

export type ClientInterface = DataInterface & {
  getAllConversations: (options: {
    ConversationCollection: typeof ConversationModelCollectionType;
  }) => Promise<ConversationModelCollectionType>;
  getAllGroupsInvolvingId: (
    id: string,
    options: {
      ConversationCollection: typeof ConversationModelCollectionType;
    }
  ) => Promise<ConversationModelCollectionType>;
  getAllPrivateConversations: (options: {
    ConversationCollection: typeof ConversationModelCollectionType;
  }) => Promise<ConversationModelCollectionType>;
  getConversationById: (
    id: string,
    options: { Conversation: typeof ConversationModel }
  ) => Promise<ConversationModel | undefined>;
  getExpiredMessages: (options: {
    MessageCollection: typeof MessageModelCollectionType;
  }) => Promise<MessageModelCollectionType>;
  getMessageById: (
    id: string,
    options: { Message: typeof MessageModel }
  ) => Promise<MessageType | undefined>;
  getMessageBySender: (
    data: {
      source: string;
      sourceUuid: string;
      sourceDevice: string;
      sent_at: number;
    },
    options: { Message: typeof MessageModel }
  ) => Promise<MessageModel | null>;
  getMessagesBySentAt: (
    sentAt: number,
    options: { MessageCollection: typeof MessageModelCollectionType }
  ) => Promise<MessageModelCollectionType>;
  getOlderMessagesByConversation: (
    conversationId: string,
    options: {
      limit?: number;
      messageId?: string;
      receivedAt?: number;
      sentAt?: number;
      MessageCollection: typeof MessageModelCollectionType;
    }
  ) => Promise<MessageModelCollectionType>;
  getNewerMessagesByConversation: (
    conversationId: string,
    options: {
      limit?: number;
      receivedAt?: number;
      sentAt?: number;
      MessageCollection: typeof MessageModelCollectionType;
    }
  ) => Promise<MessageModelCollectionType>;
  getLastConversationActivity: (options: {
    conversationId: string;
    ourConversationId: string;
    Message: typeof MessageModel;
  }) => Promise<MessageModel | undefined>;
  getLastConversationPreview: (options: {
    conversationId: string;
    ourConversationId: string;
    Message: typeof MessageModel;
  }) => Promise<MessageModel | undefined>;
  getNextExpiringMessage: (options: {
    Message: typeof MessageModel;
  }) => Promise<MessageModel | null>;
  getNextTapToViewMessageToAgeOut: (options: {
    Message: typeof MessageModel;
  }) => Promise<MessageModel | null>;
  getOutgoingWithoutExpiresAt: (options: {
    MessageCollection: typeof MessageModelCollectionType;
  }) => Promise<MessageModelCollectionType>;
  getTapToViewMessagesNeedingErase: (options: {
    MessageCollection: typeof MessageModelCollectionType;
  }) => Promise<MessageModelCollectionType>;
  getUnreadByConversation: (
    conversationId: string,
    options: { MessageCollection: typeof MessageModelCollectionType }
  ) => Promise<MessageModelCollectionType>;
  removeConversation: (
    id: string,
    options: { Conversation: typeof ConversationModel }
  ) => Promise<void>;
  removeMessage: (
    id: string,
    options: { Message: typeof MessageModel }
  ) => Promise<void>;
  removeMessages: (
    ids: Array<string>,
    options: { Message: typeof MessageModel }
  ) => Promise<void>;
  saveMessage: (
    data: MessageType,
    options: { forceSave?: boolean; Message: typeof MessageModel }
  ) => Promise<string>;
  updateConversation: (data: ConversationType, extra?: unknown) => void;

  // Test-only

  _getAllMessages: (options: {
    MessageCollection: typeof MessageModelCollectionType;
  }) => Promise<MessageModelCollectionType>;

  // Client-side only

  shutdown: () => Promise<void>;
  removeAllMessagesInConversation: (
    conversationId: string,
    options: {
      logId: string;
      MessageCollection: typeof MessageModelCollectionType;
    }
  ) => Promise<void>;
  removeOtherData: () => Promise<void>;
  cleanupOrphanedAttachments: () => Promise<void>;
  ensureFilePermissions: () => Promise<void>;

  // Client-side only, and test-only

  _removeConversations: (ids: Array<string>) => Promise<void>;
  _jobs: { [id: string]: ClientJobType };

  // These are defined on the server-only and used in the client to determine
  // whether we should use IPC to use the database in the main process or
  // use the db already running in the renderer.
  goBackToMainProcess: () => void;
};

export type ClientJobType = {
  fnName: string;
  start: number;
  resolve?: Function;
  reject?: Function;

  // Only in DEBUG mode
  complete?: boolean;
  args?: Array<any>;
};
