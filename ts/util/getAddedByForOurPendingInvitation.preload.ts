// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

export function getAddedByForOurPendingInvitation(
  conversation: ConversationType
): ConversationType | null {
  const ourAci = itemStorage.user.getCheckedAci();
  const ourPni = itemStorage.user.getPni();
  const addedBy = conversation.pendingMemberships?.find(
    item => item.serviceId === ourAci || item.serviceId === ourPni
  )?.addedByUserId;
  if (addedBy == null) {
    return null;
  }
  return window.ConversationController.get(addedBy)?.format() ?? null;
}
