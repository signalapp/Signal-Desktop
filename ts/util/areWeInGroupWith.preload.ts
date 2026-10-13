// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { itemStorage } from '../textsecure/Storage.preload.ts';
import { isGroupV2 } from './whatTypeOfConversation.dom.ts';

import type { AciString } from '../types/ServiceId.std.ts';

export function areWeInGroupWith(memberAci: AciString): boolean {
  const ourAci = itemStorage.user.getCheckedAci();

  return window.ConversationController.getAll().some(
    conversation =>
      isGroupV2(conversation.attributes) &&
      !conversation.get('terminated') &&
      conversation.hasMember(ourAci) &&
      // hasMember will return false for blocked users, so this check needs to be manual
      conversation.get('membersV2')?.some(member => member.aci === memberAci)
  );
}
