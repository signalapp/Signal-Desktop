// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { ConversationModel } from '../models/conversations.js';
import type { ConversationType } from '../state/ducks/conversations.js';
import { isInSystemContacts } from './isInSystemContacts.js';
import { isSignalConversation } from './isSignalConversation.js';
import { isDirectConversation } from './whatTypeOfConversation.js';
import { isConversationEverUnregistered } from './isConversationUnregistered.js';
import { isBlocked } from './isBlocked.js';

export function isSignalConnection(
  conversation: ConversationType | ConversationAttributesType
): boolean {
  return (
    isDirectConversation(conversation) &&
    (conversation.profileSharing || isInSystemContacts(conversation)) &&
    conversation.serviceId !== undefined &&
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
