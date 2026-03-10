// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '@signalapp/mock-server/src/types';
import type { ConversationModel } from '../../models/conversations.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

export function isValidSenderAciForConversation(
  conversation: ConversationModel,
  senderAci: AciString
): boolean {
  const ourAci = itemStorage.user.getCheckedAci();

  if (senderAci === ourAci) {
    return true;
  }

  return conversation.hasMember(senderAci);
}
