// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Environment, getEnvironment } from '../environment';
import * as grapheme from '../util/grapheme';
import * as RemoteConfig from '../RemoteConfig';
import { isAlpha, isBeta, isProduction } from '../util/version';

export const CHAT_FOLDER_NAME_MAX_CHAR_LENGTH = 32;

export enum ChatFolderType {
  ALL = 1,
  CUSTOM = 2,
}

export type ChatFolderId = string & { ChatFolderId: never };

export type ChatFolderRecord = Readonly<{
  id: ChatFolderId;
  name: string;
  showOnlyUnread: boolean;
  showMutedChats: boolean;
  includeAllIndividualChats: boolean;
  includeAllGroupChats: boolean;
  folderType: ChatFolderType;
  includedConversationIds: ReadonlyArray<string>;
  excludedConversationIds: ReadonlyArray<string>;
}>;

export type ChatFolderParams = Omit<ChatFolderRecord, 'id'>;
export type ChatFolderPreset = Omit<ChatFolderParams, 'name'>;

export const CHAT_FOLDER_DEFAULTS: ChatFolderParams = {
  name: '',
  showOnlyUnread: false,
  showMutedChats: false,
  includeAllIndividualChats: false,
  includeAllGroupChats: false,
  folderType: ChatFolderType.CUSTOM,
  includedConversationIds: [],
  excludedConversationIds: [],
};

export const CHAT_FOLDER_PRESETS = {
  UNREAD_CHATS: {
    showOnlyUnread: true, // only unread
    showMutedChats: false,
    includeAllIndividualChats: true, // all 1:1's
    includeAllGroupChats: true, // all groups
    folderType: ChatFolderType.CUSTOM,
    includedConversationIds: [],
    excludedConversationIds: [],
  },
  INDIVIDUAL_CHATS: {
    showOnlyUnread: false,
    showMutedChats: false,
    includeAllIndividualChats: true, // all 1:1's
    includeAllGroupChats: false,
    folderType: ChatFolderType.CUSTOM,
    includedConversationIds: [],
    excludedConversationIds: [],
  },
  GROUP_CHATS: {
    showOnlyUnread: false,
    showMutedChats: false,
    includeAllIndividualChats: false,
    includeAllGroupChats: true, // all groups
    folderType: ChatFolderType.CUSTOM,
    includedConversationIds: [],
    excludedConversationIds: [],
  },
} as const satisfies Record<string, ChatFolderPreset>;

export type ChatFolderPresetKey = keyof typeof CHAT_FOLDER_PRESETS;

export function normalizeChatFolderParams(
  params: ChatFolderParams
): ChatFolderParams {
  return {
    ...params,
    name: params.name.normalize().trim(),
  };
}

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
    params.showOnlyUnread === preset.showOnlyUnread &&
    params.showMutedChats === preset.showMutedChats &&
    params.includeAllIndividualChats === preset.includeAllIndividualChats &&
    params.includeAllGroupChats === preset.includeAllGroupChats &&
    params.folderType === preset.folderType &&
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

  const env = getEnvironment();
  return env === Environment.Development || env === Environment.Test;
}
