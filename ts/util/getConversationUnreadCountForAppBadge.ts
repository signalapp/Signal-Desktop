// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import { isConversationMuted } from './isConversationMuted';

export function getConversationUnreadCountForAppBadge(
  conversation: Readonly<
    Pick<
      ConversationAttributesType,
      | 'active_at'
      | 'isArchived'
      | 'markedUnread'
      | 'muteExpiresAt'
      | 'unreadCount'
    >
  >,
  canCountMutedConversations: boolean
): number {
  const { isArchived, markedUnread, unreadCount } = conversation;

  if (!conversation.active_at) {
    return 0;
  }

  if (isArchived) {
    return 0;
  }

  if (!canCountMutedConversations && isConversationMuted(conversation)) {
    return 0;
  }

  if (unreadCount) {
    return unreadCount;
  }

  if (markedUnread) {
    return 1;
  }

  return 0;
}
