// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../util/assert.std.js';
import { ChatFolderType } from './ChatFolder.std.js';
import type { ChatFolder, ChatFolderId } from './ChatFolder.std.js';

export type CurrentChatFolder = ChatFolder &
  Readonly<{
    folderType: ChatFolderType.ALL | ChatFolderType.CUSTOM;
    deletedAtTimestampMs: 0;
  }>;

export type CurrentAllChatFolder = CurrentChatFolder &
  Readonly<{
    folderType: ChatFolderType.ALL;
  }>;

export type CurrentCustomChatFolder = CurrentChatFolder &
  Readonly<{
    folderType: ChatFolderType.CUSTOM;
  }>;

export function isCurrentChatFolder(
  chatFolder: ChatFolder
): chatFolder is CurrentChatFolder {
  return (
    chatFolder.deletedAtTimestampMs === 0 &&
    chatFolder.folderType !== ChatFolderType.UNKNOWN
  );
}

export function isCurrentAllChatFolder(
  chatFolder: ChatFolder
): chatFolder is CurrentAllChatFolder {
  return (
    isCurrentChatFolder(chatFolder) &&
    chatFolder.folderType === ChatFolderType.ALL
  );
}

export function isCurrentCustomChatFolder(
  chatFolder: ChatFolder
): chatFolder is CurrentCustomChatFolder {
  return (
    isCurrentChatFolder(chatFolder) &&
    chatFolder.folderType === ChatFolderType.CUSTOM
  );
}

export type CurrentChatFolders = Readonly<{
  order: ReadonlyArray<ChatFolderId>;
  lookup: Partial<Record<ChatFolderId, CurrentChatFolder>>;
  currentAllChatFolder: CurrentAllChatFolder | null;
  hasAnyCurrentCustomChatFolders: boolean;
}>;

// eslint-disable-next-line max-len
// eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-redeclare
export namespace CurrentChatFolders {
  export function createEmpty(): CurrentChatFolders {
    return {
      order: [],
      lookup: {},
      currentAllChatFolder: null,
      hasAnyCurrentCustomChatFolders: false,
    };
  }

  export function fromArray(
    chatFolders: ReadonlyArray<CurrentChatFolder>
  ): CurrentChatFolders {
    let currentAllChatFolder: CurrentAllChatFolder | null = null;
    let hasAnyCurrentCustomChatFolders = false;

    const order = chatFolders
      .toSorted((a, b) => a.position - b.position)
      .map(chatFolder => chatFolder.id);

    const lookup: Record<ChatFolderId, CurrentChatFolder> = {};
    for (const chatFolder of chatFolders) {
      if (isCurrentCustomChatFolder(chatFolder)) {
        hasAnyCurrentCustomChatFolders = true;
      } else if (isCurrentAllChatFolder(chatFolder)) {
        if (currentAllChatFolder != null) {
          throw new Error(
            `Multiple current all chats chat folders (${currentAllChatFolder.id}, ${chatFolder.id})`
          );
        }
        currentAllChatFolder = chatFolder;
      } else {
        throw new TypeError(
          `Chat folder is not current ${chatFolder.id} (${chatFolder.folderType}, ${chatFolder.deletedAtTimestampMs})`
        );
      }

      lookup[chatFolder.id] = chatFolder;
    }

    return {
      order,
      lookup,
      currentAllChatFolder,
      hasAnyCurrentCustomChatFolders,
    };
  }

  export function size(state: CurrentChatFolders): number {
    return state.order.length;
  }

  export function has(state: CurrentChatFolders, id: ChatFolderId): boolean {
    return Object.hasOwn(state.lookup, id);
  }

  export function get(
    state: CurrentChatFolders,
    id: ChatFolderId
  ): CurrentChatFolder | null {
    if (has(state, id)) {
      return state.lookup[id] ?? null;
    }
    return null;
  }

  export function expect(
    state: CurrentChatFolders,
    id: ChatFolderId,
    reason: string
  ): CurrentChatFolder {
    const chatFolder = get(state, id);
    strictAssert(
      chatFolder != null,
      `Expected chat folder to exist in state ${id} (${reason})`
    );
    return chatFolder;
  }

  export function at(
    state: CurrentChatFolders,
    index: number
  ): CurrentChatFolder | null {
    const chatFolderId = state.order.at(index);
    if (chatFolderId != null) {
      return get(state, chatFolderId);
    }
    return null;
  }

  export function toSortedArray(
    state: CurrentChatFolders
  ): ReadonlyArray<CurrentChatFolder> {
    return state.order.map(id => {
      return expect(state, id, 'toSortedArray');
    });
  }
}
