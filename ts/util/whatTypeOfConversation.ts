// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ConversationAttributesType } from '../model-types.d';

export function isDirectConversation(
  conversationAttrs: ConversationAttributesType
): boolean {
  return conversationAttrs.type === 'private';
}

export function isMe(conversationAttrs: ConversationAttributesType): boolean {
  const { e164, uuid } = conversationAttrs;
  const ourNumber = window.textsecure.storage.user.getNumber();
  const ourUuid = window.textsecure.storage.user.getUuid();
  return Boolean((e164 && e164 === ourNumber) || (uuid && uuid === ourUuid));
}
