// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import { isGroupV2 } from './whatTypeOfConversation.dom.ts';
import { areWeAdmin } from './areWeAdmin.preload.ts';

export function canEditGroupInfo(
  conversationAttrs: ConversationAttributesType
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }

  if (conversationAttrs.left) {
    return false;
  }

  if (conversationAttrs.terminated) {
    return false;
  }

  if (areWeAdmin(conversationAttrs)) {
    return true;
  }

  return (
    conversationAttrs.accessControl?.attributes ===
    Proto.AccessControl.AccessRequired.MEMBER
  );
}
