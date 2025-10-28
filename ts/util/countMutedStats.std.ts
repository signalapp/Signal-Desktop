// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations.preload.js';
import {
  isConversationInChatFolder,
  type ChatFolderId,
} from '../types/ChatFolder.std.js';
import { CurrentChatFolders } from '../types/CurrentChatFolders.std.js';
import { isConversationMuted } from './isConversationMuted.std.js';

type MutableMutedStats = {
  chatsMutedCount: number;
  chatsUnmutedCount: number;
};

export type MutedStats = Readonly<MutableMutedStats>;

export type AllChatFoldersMutedStats = Map<ChatFolderId, MutedStats>;

function createMutedStats(): MutableMutedStats {
  return {
    chatsMutedCount: 0,
    chatsUnmutedCount: 0,
  };
}

export type ConversationPropsForMutedStats = Readonly<
  Pick<ConversationType, 'id' | 'type' | 'activeAt' | 'muteExpiresAt'>
>;

export function countAllChatFoldersMutedStats(
  currentChatFolders: CurrentChatFolders,
  conversations: ReadonlyArray<ConversationPropsForMutedStats>
): AllChatFoldersMutedStats {
  const results = new Map<ChatFolderId, MutableMutedStats>();
  const sortedChatFolders =
    CurrentChatFolders.toSortedArray(currentChatFolders);

  for (const conversation of conversations) {
    const isMuted = isConversationMuted(conversation);

    // check which chatFolders should count this conversation
    for (const chatFolder of sortedChatFolders) {
      if (isConversationInChatFolder(chatFolder, conversation)) {
        let mutedStats = results.get(chatFolder.id);
        if (mutedStats == null) {
          mutedStats = createMutedStats();
          results.set(chatFolder.id, mutedStats);
        }

        if (isMuted) {
          mutedStats.chatsMutedCount += 1;
        } else {
          mutedStats.chatsUnmutedCount += 1;
        }
      }
    }
  }

  return results;
}
