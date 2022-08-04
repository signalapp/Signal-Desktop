// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { ConversationModel } from '../models/conversations';
import type { ConversationType } from '../state/ducks/conversations';
import { isInSystemContacts } from './isInSystemContacts';
import { isDirectConversation } from './whatTypeOfConversation';

export function isSignalConnection(
  conversation: ConversationType | ConversationAttributesType
): boolean {
  return (
    isDirectConversation(conversation) &&
    (conversation.profileSharing || isInSystemContacts(conversation))
  );
}

export function getSignalConnections(): Array<ConversationModel> {
  return window
    .getConversations()
    .filter(conversation => isSignalConnection(conversation.attributes));
}
