// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import type { Simplify } from 'type-fest';
import {
  Environment,
  getEnvironment,
  isMockEnvironment,
} from '../environment.js';
import * as grapheme from '../util/grapheme.js';
import * as RemoteConfig from '../RemoteConfig.js';
import { isAlpha, isBeta, isProduction } from '../util/version.js';
import type { ConversationType } from '../state/ducks/conversations.js';
import { strictAssert } from '../util/assert.js';
import { isConversationUnread } from '../util/isConversationUnread.js';

export const CHAT_FOLDER_NAME_MAX_CHAR_LENGTH = 32;

export const CHAT_FOLDER_DELETED_POSITION = 4294967295; // 2^32-1 (max uint32)

export enum ChatFolderType {
  UNKNOWN = 0,
  ALL = 1,
  CUSTOM = 2,
}

export type ChatFolderId = string & { ChatFolderId: never }; // uuid

export type ChatFolderPreset = Simplify<
  Readonly<{
    folderType: ChatFolderType;
    showOnlyUnread: boolean;
    showMutedChats: boolean;
    includeAllIndividualChats: boolean;
    includeAllGroupChats: boolean;
    includedConversationIds: ReadonlyArray<string>;
    excludedConversationIds: ReadonlyArray<string>;
  }>
>;

export type ChatFolderParams = Simplify<
  Readonly<
    ChatFolderPreset & {
      name: string;
    }
  >
>;

export type ChatFolder = Simplify<
  Readonly<
    ChatFolderParams & {
      id: ChatFolderId;
      position: number;
      deletedAtTimestampMs: number;
      storageID: string | null;
      storageVersion: number | null;
      storageUnknownFields: Uint8Array | null;
      storageNeedsSync: boolean;
    }
  >
>;

export const ChatFolderPresetSchema = z.object({
  folderType: z.nativeEnum(ChatFolderType),
  showOnlyUnread: z.boolean(),
  showMutedChats: z.boolean(),
  includeAllIndividualChats: z.boolean(),
  includeAllGroupChats: z.boolean(),
  includedConversationIds: z.array(z.string().uuid()).readonly(),
  excludedConversationIds: z.array(z.string().uuid()).readonly(),
}) satisfies z.ZodType<ChatFolderPreset>;

export const ChatFolderParamsSchema = ChatFolderPresetSchema.extend({
  name: z.string().transform(input => input.normalize().trim()),
}) satisfies z.ZodType<ChatFolderParams>;

export const ChatFolderSchema = ChatFolderParamsSchema.extend({
  id: z.intersection(z.string(), z.custom<ChatFolderId>()),
  position: z.number().int().gte(0),
  deletedAtTimestampMs: z.number().int().positive(),
  storageID: z.string().nullable(),
  storageVersion: z.number().nullable(),
  storageUnknownFields: z.instanceof(Uint8Array).nullable(),
  storageNeedsSync: z.boolean(),
}) satisfies z.ZodType<ChatFolder>;

export const CHAT_FOLDER_DEFAULTS: ChatFolderParams = {
  folderType: ChatFolderType.CUSTOM,
  name: '',
  showOnlyUnread: false,
  showMutedChats: true,
  includeAllIndividualChats: false,
  includeAllGroupChats: false,
  includedConversationIds: [],
  excludedConversationIds: [],
};

export const CHAT_FOLDER_PRESETS = {
  UNREAD_CHATS: {
    ...CHAT_FOLDER_DEFAULTS,
    showOnlyUnread: true, // only unread
    includeAllIndividualChats: true, // all 1:1's
    includeAllGroupChats: true, // all groups
  },
  INDIVIDUAL_CHATS: {
    ...CHAT_FOLDER_DEFAULTS,
    includeAllIndividualChats: true, // all 1:1's
  },
  GROUP_CHATS: {
    ...CHAT_FOLDER_DEFAULTS,
    includeAllGroupChats: true, // all groups
  },
} as const satisfies Record<string, ChatFolderPreset>;

export type ChatFolderPresetKey = keyof typeof CHAT_FOLDER_PRESETS;

export function validateChatFolderParams(params: ChatFolderParams): boolean {
  return (
    params.name !== '' &&
    grapheme.count(params.name) <= CHAT_FOLDER_NAME_MAX_CHAR_LENGTH
  );
}

export function matchesChatFolderPreset(
  params: ChatFolderParams,
  preset: ChatFolderPreset
): boolean {
  return (
    params.folderType === preset.folderType &&
    params.showOnlyUnread === preset.showOnlyUnread &&
    params.showMutedChats === preset.showMutedChats &&
    params.includeAllIndividualChats === preset.includeAllIndividualChats &&
    params.includeAllGroupChats === preset.includeAllGroupChats &&
    isSameConversationIds(
      params.includedConversationIds,
      preset.includedConversationIds
    ) &&
    isSameConversationIds(
      params.excludedConversationIds,
      preset.excludedConversationIds
    )
  );
}

export function isSameChatFolderParams(
  a: ChatFolderParams,
  b: ChatFolderParams
): boolean {
  return a.name === b.name && matchesChatFolderPreset(a, b);
}

function isSameConversationIds(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>
): boolean {
  return new Set(a).symmetricDifference(new Set(b)).size === 0;
}

export function isChatFoldersEnabled(): boolean {
  const env = getEnvironment();

  if (
    env === Environment.Development ||
    env === Environment.Test ||
    isMockEnvironment()
  ) {
    return true;
  }

  const version = window.getVersion?.();

  if (version != null) {
    if (isProduction(version)) {
      return RemoteConfig.isEnabled('desktop.chatFolders.prod');
    }
    if (isBeta(version)) {
      return RemoteConfig.isEnabled('desktop.chatFolders.beta');
    }
    if (isAlpha(version)) {
      return RemoteConfig.isEnabled('desktop.chatFolders.alpha');
    }
  }

  return false;
}

type ConversationPropsForChatFolder = Pick<
  ConversationType,
  'type' | 'id' | 'unreadCount' | 'markedUnread' | 'muteExpiresAt'
>;

function _isConversationIncludedInChatFolder(
  chatFolder: ChatFolder,
  conversation: ConversationPropsForChatFolder
): boolean {
  if (chatFolder.includeAllIndividualChats && conversation.type === 'direct') {
    return true; // is individual chat
  }
  if (chatFolder.includeAllGroupChats && conversation.type === 'group') {
    return true; // is group chat
  }
  if (chatFolder.includedConversationIds.includes(conversation.id)) {
    return true; // is included by id
  }
  return false;
}

function _isConversationExcludedFromChatFolder(
  chatFolder: ChatFolder,
  conversation: ConversationPropsForChatFolder
): boolean {
  if (chatFolder.showOnlyUnread && !isConversationUnread(conversation)) {
    return true; // not unread, only showing unread
  }
  if (!chatFolder.showMutedChats && (conversation.muteExpiresAt ?? 0) > 0) {
    return true; // muted, not showing muted chats
  }
  if (chatFolder.excludedConversationIds.includes(conversation.id)) {
    return true; // is excluded by id
  }
  return false;
}

export function isConversationInChatFolder(
  chatFolder: ChatFolder,
  conversation: ConversationPropsForChatFolder
): boolean {
  if (chatFolder.folderType === ChatFolderType.ALL) {
    return true;
  }

  return (
    _isConversationIncludedInChatFolder(chatFolder, conversation) &&
    !_isConversationExcludedFromChatFolder(chatFolder, conversation)
  );
}

export type CurrentChatFolders = Readonly<{
  order: ReadonlyArray<ChatFolderId>;
  lookup: Partial<Record<ChatFolderId, ChatFolder>>;
}>;

export function toCurrentChatFolders(
  chatFolders: ReadonlyArray<ChatFolder>
): CurrentChatFolders {
  const order = chatFolders
    .toSorted((a, b) => a.position - b.position)
    .map(chatFolder => chatFolder.id);

  const lookup: Record<ChatFolderId, ChatFolder> = {};
  for (const chatFolder of chatFolders) {
    lookup[chatFolder.id] = chatFolder;
  }

  return { order, lookup };
}

export function getSortedCurrentChatFolders(
  currentChatFolders: CurrentChatFolders
): ReadonlyArray<ChatFolder> {
  return currentChatFolders.order.map(chatFolderId => {
    return lookupCurrentChatFolder(currentChatFolders, chatFolderId);
  });
}

export function lookupCurrentChatFolder(
  currentChatFolders: CurrentChatFolders,
  chatFolderId: ChatFolderId
): ChatFolder {
  const chatFolder = currentChatFolders.lookup[chatFolderId];
  strictAssert(chatFolder != null, 'Missing chat folder');
  return chatFolder;
}
