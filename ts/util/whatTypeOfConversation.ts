// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ConversationAttributesType } from '../model-types.d';
import { base64ToArrayBuffer, fromEncodedBinaryToArrayBuffer } from '../Crypto';

export enum ConversationTypes {
  Me = 'Me',
  Direct = 'Direct',
  GroupV1 = 'GroupV1',
  GroupV2 = 'GroupV2',
}

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

export function isGroupV1(
  conversationAttrs: ConversationAttributesType
): boolean {
  const { groupId } = conversationAttrs;
  if (!groupId) {
    return false;
  }

  const buffer = fromEncodedBinaryToArrayBuffer(groupId);
  return buffer.byteLength === window.Signal.Groups.ID_V1_LENGTH;
}

export function isGroupV2(
  conversationAttrs: ConversationAttributesType
): boolean {
  const { groupId, groupVersion = 0 } = conversationAttrs;
  if (!groupId) {
    return false;
  }

  try {
    return (
      groupVersion === 2 &&
      base64ToArrayBuffer(groupId).byteLength === window.Signal.Groups.ID_LENGTH
    );
  } catch (error) {
    window.log.error('isGroupV2: Failed to process groupId in base64!');
    return false;
  }
}

export function typeofConversation(
  conversationAttrs: ConversationAttributesType
): ConversationTypes | undefined {
  if (isMe(conversationAttrs)) {
    return ConversationTypes.Me;
  }

  if (isDirectConversation(conversationAttrs)) {
    return ConversationTypes.Direct;
  }

  if (isGroupV2(conversationAttrs)) {
    return ConversationTypes.GroupV2;
  }

  if (isGroupV1(conversationAttrs)) {
    return ConversationTypes.GroupV1;
  }

  return undefined;
}
