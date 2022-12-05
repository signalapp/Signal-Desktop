// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UUID } from '../types/UUID';
import type { ConversationAttributesType } from '../model-types.d';
import { isGroupV2 } from './whatTypeOfConversation';

export function isMemberPending(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'pendingMembersV2'
  >,
  uuid: UUID
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { pendingMembersV2 } = conversationAttrs;

  if (!pendingMembersV2 || !pendingMembersV2.length) {
    return false;
  }

  return pendingMembersV2.some(item => item.uuid === uuid.toString());
}
