// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { ConversationModel } from '../models/conversations';
import type { ConversationType } from '../state/ducks/conversations';
import { isInSystemContacts } from './isInSystemContacts';
import { isSignalConversation } from './isSignalConversation';
import { isDirectConversation } from './whatTypeOfConversation';
import { isConversationEverUnregistered } from './isConversationUnregistered';
import { isBlocked } from './isBlocked';

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
  return window
    .getConversations()
    .filter(conversation => isSignalConnection(conversation.attributes));
}
