// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import { isAnnouncementGroupReady } from './isAnnouncementGroupReady';
import { isGroupV2 } from './whatTypeOfConversation';

export function canBeAnnouncementGroup(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'pendingAdminApprovalV2'
  >
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }

  if (!isAnnouncementGroupReady()) {
    return false;
  }

  return true;
}
