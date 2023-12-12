// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import type { ConversationModel } from '../models/conversations';

export function getMessageConversation({
  conversationId,
}: Pick<MessageAttributesType, 'conversationId'>):
  | ConversationModel
  | undefined {
  return window.ConversationController.get(conversationId);
}
