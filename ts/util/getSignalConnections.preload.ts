// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { ConversationModel } from '../models/conversations.preload.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import { isInSystemContacts } from './isInSystemContacts.std.ts';
import { isSignalConversation } from './isSignalConversation.dom.ts';
import { isDirectConversation } from './whatTypeOfConversation.dom.ts';
import { isConversationEverUnregistered } from './isConversationUnregistered.dom.ts';
import { isBlocked } from './isBlocked.preload.ts';

export function isSignalConnection(
  conversation: ConversationType | ConversationAttributesType
): boolean {
  const ourId = window.ConversationController.getOurConversationIdOrThrow();

  return (
    conversation.id !== ourId &&
    isDirectConversation(conversation) &&
    (conversation.profileSharing || isInSystemContacts(conversation)) &&
    conversation.serviceId !== undefined &&
    conversation.removalStage == null &&
    ('isBlocked' in conversation
      ? !conversation.isBlocked
      : !isBlocked(conversation)) &&
    !isSignalConversation(conversation) &&
    !isConversationEverUnregistered(conversation)
  );
}

export function getSignalConnections(): Array<ConversationModel> {
  return window.ConversationController.getAll().filter(conversation =>
    isSignalConnection(conversation.attributes)
  );
}
