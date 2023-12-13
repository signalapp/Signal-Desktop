// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations';
import { isConversationMuted } from './isConversationMuted';

/**
 * This can be used to describe unread counts of chats, stories, and calls,
 * individually or all of them together.
 */
export type UnreadStats = Readonly<{
  unreadCount: number;
  unreadMentionsCount: number;
  markedUnread: boolean;
}>;

function getEmptyUnreadStats(): UnreadStats {
  return {
    unreadCount: 0,
    unreadMentionsCount: 0,
    markedUnread: false,
  };
}

export type UnreadStatsOptions = Readonly<{
  includeMuted: boolean;
}>;

export type ConversationPropsForUnreadStats = Readonly<
  Pick<
    ConversationType,
    | 'activeAt'
    | 'isArchived'
    | 'markedUnread'
    | 'muteExpiresAt'
    | 'unreadCount'
    | 'unreadMentionsCount'
    | 'left'
  >
>;

function canCountConversation(
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

export function countConversationUnreadStats(
  conversation: ConversationPropsForUnreadStats,
  options: UnreadStatsOptions
): UnreadStats {
  if (canCountConversation(conversation, options)) {
    return {
      unreadCount: conversation.unreadCount ?? 0,
      unreadMentionsCount: conversation.unreadMentionsCount ?? 0,
      markedUnread: conversation.markedUnread ?? false,
    };
  }
  return getEmptyUnreadStats();
}

export function countAllConversationsUnreadStats(
  conversations: ReadonlyArray<ConversationPropsForUnreadStats>,
  options: UnreadStatsOptions
): UnreadStats {
  return conversations.reduce<UnreadStats>((total, conversation) => {
    const stats = countConversationUnreadStats(conversation, options);
    return {
      unreadCount: total.unreadCount + stats.unreadCount,
      unreadMentionsCount:
        total.unreadMentionsCount + stats.unreadMentionsCount,
      markedUnread: total.markedUnread || stats.markedUnread,
    };
  }, getEmptyUnreadStats());
}

export function hasUnread(unreadStats: UnreadStats): boolean {
  return (
    unreadStats.unreadCount > 0 ||
    unreadStats.unreadMentionsCount > 0 ||
    unreadStats.markedUnread
  );
}
