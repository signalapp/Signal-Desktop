// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import { isGroupV2 } from './whatTypeOfConversation.dom.js';

export function canBeAnnouncementGroup(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'pendingAdminApprovalV2'
  >
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }

  return true;
}
