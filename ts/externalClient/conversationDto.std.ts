// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import { isConversationMuted } from '../util/isConversationMuted.std.ts';
import type { ConversationDTO } from './protocol.std.ts';

// Maps Signal's conversation view model to the public DTO. Fields are copied
// one by one on purpose: a new internal field must never reach clients just
// because it was added to ConversationType.

export type ConversationSourceType = Pick<
  ConversationType,
  | 'id'
  | 'type'
  | 'title'
  | 'activeAt'
  | 'unreadCount'
  | 'unreadMentionsCount'
  | 'markedUnread'
  | 'lastMessageReceivedAtMs'
  | 'timestamp'
  | 'muteExpiresAt'
  | 'isArchived'
  | 'isPinned'
  | 'isBlocked'
  | 'isMe'
  | 'acceptedMessageRequest'
  | 'membersCount'
>;

// Same rule as the left pane (_getLeftPaneLists): a conversation is listed
// when it is pinned or has had activity.
export function isListedConversation(
  conversation: ConversationSourceType
): boolean {
  if (conversation.isPinned) {
    return true;
  }
  return conversation.activeAt != null && conversation.activeAt !== 0;
}

export function toConversationDTO(
  conversation: ConversationSourceType
): ConversationDTO {
  const lastActivityAt =
    conversation.lastMessageReceivedAtMs || conversation.timestamp || null;
  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title,
    unreadCount: conversation.unreadCount ?? 0,
    unreadMentionsCount: conversation.unreadMentionsCount ?? 0,
    markedUnread: conversation.markedUnread ?? false,
    lastActivityAt,
    muted: isConversationMuted(conversation),
    archived: conversation.isArchived ?? false,
    pinned: conversation.isPinned ?? false,
    blocked: conversation.isBlocked ?? false,
    noteToSelf: conversation.isMe,
    messageRequestPending: !conversation.acceptedMessageRequest,
    memberCount:
      conversation.type === 'group'
        ? (conversation.membersCount ?? null)
        : null,
  };
}
