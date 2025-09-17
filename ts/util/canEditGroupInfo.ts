// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import { SignalService as Proto } from '../protobuf/index.js';
import { isGroupV2 } from './whatTypeOfConversation.js';
import { areWeAdmin } from './areWeAdmin.js';

export function canEditGroupInfo(
  conversationAttrs: ConversationAttributesType
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }

  if (conversationAttrs.left) {
    return false;
  }

  return (
    areWeAdmin(conversationAttrs) ||
    conversationAttrs.accessControl?.attributes ===
      Proto.AccessControl.AccessRequired.MEMBER
  );
}
