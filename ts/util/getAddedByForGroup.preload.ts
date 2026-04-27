// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

export function getAddedByForGroup(
  conversation: ConversationType
): ConversationType | null {
  const ourAci = itemStorage.user.getCheckedAci();
  const ourPni = itemStorage.user.getPni();

  let addedByAci;
  addedByAci = conversation.pendingMemberships?.find(
    item => item.serviceId === ourAci || item.serviceId === ourPni
  )?.addedByUserId;

  if (addedByAci == null) {
    const conversationModel = window.ConversationController.get(
      conversation.id
    );
    addedByAci = conversationModel?.attributes.addedBy;
  }

  return window.ConversationController.get(addedByAci)?.format() ?? null;
}
