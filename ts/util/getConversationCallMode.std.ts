// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import { CallMode } from '../types/CallDisposition.std.ts';

export const getConversationCallMode = (
  conversation: ConversationType
): CallMode | null => {
  if (
    conversation.left ||
    conversation.isBlocked ||
    conversation.isMe ||
    !conversation.acceptedMessageRequest
  ) {
    return null;
  }

  if (conversation.type === 'direct') {
    return CallMode.Direct;
  }

  if (conversation.type === 'group' && conversation.groupVersion === 2) {
    return CallMode.Group;
  }

  return null;
};
