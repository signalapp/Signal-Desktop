// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { isConversationInChatFolder } from '../types/ChatFolder.std.js';
import type { ChatFolderId } from '../types/ChatFolder.std.js';
import { CurrentChatFolders } from '../types/CurrentChatFolders.std.js';
import { isConversationMuted } from './isConversationMuted.std.js';

type MutableUnreadStats = {
  /**
   * Total of `conversation.unreadCount`
   * in all countable conversations in the set.
   *
   * Note: `conversation.unreadCount` should always include the number of
   * unread messages with mentions.
   */
  unreadCount: number;

  /**
   * Total of `conversation.unreadMentionsCount`
   * in all countable conversations in the set.
   */
  unreadMentionsCount: number;

  /**
   * Total of `unreadCount === 0 && markedRead == true`
   * in all countable conversations in the set.
   */
  readChatsMarkedUnreadCount: number;
};

/**
 * This can be used to describe unread counts of chats, stories, and calls,
 * individually or all of them together.
 */
export type UnreadStats = Readonly<MutableUnreadStats>;

function createUnreadStats(): MutableUnreadStats {
  return {
    unreadCount: 0,
    unreadMentionsCount: 0,
    readChatsMarkedUnreadCount: 0,
  };
}

export type UnreadStatsOptions = Readonly<{
  includeMuted: boolean;
}>;

export type ConversationPropsForUnreadStats = Readonly<
  Pick<
    ConversationType,
    | 'id'
    | 'type'
    | 'activeAt'
    | 'isArchived'
    | 'markedUnread'
    | 'muteExpiresAt'
    | 'unreadCount'
    | 'unreadMentionsCount'
    | 'left'
  >
>;

export type AllChatFoldersUnreadStats = Map<ChatFolderId, UnreadStats>;

function _canCountConversation(
  conversation: ConversationPropsForUnreadStats,
  options: UnreadStatsOptions
): boolean {
  if (conversation.activeAt == null || conversation.activeAt === 0) {
    return false;
  }
  if (conversation.isArchived) {
    return false;
  }
  if (!options.includeMuted && isConversationMuted(conversation)) {
    return false;
  }
  if (conversation.left) {
    return false;
  }
  return true;
}

/** @private */
function _countConversation(
  unreadStats: MutableUnreadStats,
  conversation: ConversationPropsForUnreadStats
): void {
  const mutable = unreadStats;
  const {
    unreadCount = 0,
    unreadMentionsCount = 0,
    markedUnread = false,
  } = conversation;

  const hasUnreadCount = unreadCount > 0;

  if (hasUnreadCount) {
    mutable.unreadCount += unreadCount;
    mutable.unreadMentionsCount += unreadMentionsCount;
  } else if (markedUnread) {
    mutable.readChatsMarkedUnreadCount += 1;
  }
}

export function isConversationUnread(
  conversation: ConversationPropsForUnreadStats,
  options: UnreadStatsOptions
): boolean {
  if (!_canCountConversation(conversation, options)) {
    return false;
  }
  // Note: Don't need to look at unreadMentionsCount
  const { unreadCount, markedUnread } = conversation;
  if (unreadCount != null && unreadCount !== 0) {
    return true;
  }
  if (markedUnread) {
    return true;
  }
  return false;
}

export function countConversationUnreadStats(
  conversation: ConversationPropsForUnreadStats,
  options: UnreadStatsOptions
): UnreadStats {
  const unreadStats = createUnreadStats();
  if (_canCountConversation(conversation, options)) {
    _countConversation(unreadStats, conversation);
  }
  return unreadStats;
}

export function countAllConversationsUnreadStats(
  conversations: ReadonlyArray<ConversationPropsForUnreadStats>,
  options: UnreadStatsOptions
): UnreadStats {
  const unreadStats = createUnreadStats();

  for (const conversation of conversations) {
    if (_canCountConversation(conversation, options)) {
      _countConversation(unreadStats, conversation);
    }
  }

  return unreadStats;
}

export function countAllChatFoldersUnreadStats(
  currentChatFolders: CurrentChatFolders,
  conversations: ReadonlyArray<ConversationPropsForUnreadStats>,
  options: UnreadStatsOptions
): AllChatFoldersUnreadStats {
  const results = new Map<ChatFolderId, MutableUnreadStats>();
  const sortedChatFolders =
    CurrentChatFolders.toSortedArray(currentChatFolders);

  for (const conversation of conversations) {
    // skip if we shouldn't count it
    if (!_canCountConversation(conversation, options)) {
      continue;
    }

    const {
      unreadCount = 0,
      unreadMentionsCount = 0,
      markedUnread = false,
    } = conversation;

    // skip if we don't have any unreads
    if (unreadCount === 0 && unreadMentionsCount === 0 && !markedUnread) {
      continue;
    }

    // check which chatFolders should count this conversation
    for (const chatFolder of sortedChatFolders) {
      if (isConversationInChatFolder(chatFolder, conversation)) {
        let unreadStats = results.get(chatFolder.id);
        if (unreadStats == null) {
          unreadStats = createUnreadStats();
          results.set(chatFolder.id, unreadStats);
        }

        _countConversation(unreadStats, conversation);
      }
    }
  }

  return results;
}
