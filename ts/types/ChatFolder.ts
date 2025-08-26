// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import { Environment, getEnvironment, isMockEnvironment } from '../environment';
import * as grapheme from '../util/grapheme';
import * as RemoteConfig from '../RemoteConfig';
import { isAlpha, isBeta, isProduction } from '../util/version';

export const CHAT_FOLDER_NAME_MAX_CHAR_LENGTH = 32;

export const CHAT_FOLDER_DELETED_POSITION = 4294967295; // 2^32-1 (max uint32)

export enum ChatFolderType {
  UNKNOWN = 0,
  ALL = 1,
  CUSTOM = 2,
}

export type ChatFolderId = string & { ChatFolderId: never }; // uuid

export type ChatFolderPreset = Readonly<{
  folderType: ChatFolderType;
  showOnlyUnread: boolean;
  showMutedChats: boolean;
  includeAllIndividualChats: boolean;
  includeAllGroupChats: boolean;
  includedConversationIds: ReadonlyArray<string>;
  excludedConversationIds: ReadonlyArray<string>;
}>;

export type ChatFolderParams = Readonly<
  ChatFolderPreset & {
    name: string;
  }
>;

export type ChatFolder = Readonly<
  ChatFolderParams & {
    id: ChatFolderId;
    position: number;
    deletedAtTimestampMs: number;
    storageID: string | null;
    storageVersion: number | null;
    storageUnknownFields: Uint8Array | null;
    storageNeedsSync: boolean;
  }
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
