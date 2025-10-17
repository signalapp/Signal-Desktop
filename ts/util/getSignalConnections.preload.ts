// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { ConversationModel } from '../models/conversations.preload.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { isInSystemContacts } from './isInSystemContacts.std.js';
import { isSignalConversation } from './isSignalConversation.dom.js';
import { isDirectConversation } from './whatTypeOfConversation.dom.js';
import { isConversationEverUnregistered } from './isConversationUnregistered.dom.js';
import { isBlocked } from './isBlocked.preload.js';

export function isSignalConnection(
  conversation: ConversationType | ConversationAttributesType
): boolean {
  return (
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
