// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations';
import { isSignalConversation } from './isSignalConversation';

export function canHaveNicknameAndNote(
  conversation: ConversationType
): boolean {
  return (
    conversation.type !== 'group' &&
    !isSignalConversation(conversation) &&
    !conversation.isMe
  );
}
