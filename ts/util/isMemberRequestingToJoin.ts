// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UUID } from '../types/UUID';
import type { ConversationAttributesType } from '../model-types.d';
import { isGroupV2 } from './whatTypeOfConversation';

export function isMemberRequestingToJoin(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'pendingAdminApprovalV2'
  >,
  uuid: UUID
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { pendingAdminApprovalV2 } = conversationAttrs;

  if (!pendingAdminApprovalV2 || !pendingAdminApprovalV2.length) {
    return false;
  }

  return pendingAdminApprovalV2.some(item => item.uuid === uuid.toString());
}
