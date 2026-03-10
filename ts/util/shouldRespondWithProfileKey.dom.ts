// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../models/conversations.preload.js';
import { isInSystemContacts } from './isInSystemContacts.std.js';
import { getSharedGroupNames } from './sharedGroupNames.dom.js';
import { isMe } from './whatTypeOfConversation.dom.js';

export function shouldRespondWithProfileKey(
  sender: ConversationModel
): boolean {
  if (isMe(sender.attributes) || sender.isBlocked()) {
    return false;
  }

  if (isInSystemContacts(sender.attributes) || sender.get('profileSharing')) {
    return true;
  }

  const state = window.reduxStore.getState();
  const sharedGroupNames = getSharedGroupNames(state, sender.id);
  return sharedGroupNames.length > 0;
}
