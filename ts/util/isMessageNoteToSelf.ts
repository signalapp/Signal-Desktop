// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';

export function isMessageNoteToSelf(
  message: Pick<ReadonlyMessageAttributesType, 'conversationId'>
): boolean {
  return (
    message.conversationId ===
    window.ConversationController.getOurConversationId()
  );
}
