// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';
import type { ConversationModel } from '../models/conversations';

export function getMessageConversation({
  conversationId,
}: Pick<ReadonlyMessageAttributesType, 'conversationId'>):
  | ConversationModel
  | undefined {
  return window.ConversationController.get(conversationId);
}
