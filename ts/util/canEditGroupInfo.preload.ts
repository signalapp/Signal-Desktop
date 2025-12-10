// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { isGroupV2 } from './whatTypeOfConversation.dom.js';
import { areWeAdmin } from './areWeAdmin.preload.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';

function getConversationAccessControlAttributes(
  conversation: ConversationAttributesType | ConversationType
): number | null {
  if ('accessControl' in conversation) {
    return conversation.accessControl?.attributes ?? null;
  }

  if ('accessControlAttributes' in conversation) {
    return conversation.accessControlAttributes ?? null;
  }

  return null;
}

export function canEditGroupInfo(
  conversationAttrs: ConversationAttributesType | ConversationType
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }

  if (conversationAttrs.left) {
    return false;
  }

  if (areWeAdmin(conversationAttrs)) {
    return true;
  }

  const accessControlAttributes =
    getConversationAccessControlAttributes(conversationAttrs);
  return accessControlAttributes === Proto.AccessControl.AccessRequired.MEMBER;
}
