// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ConversationAttributesType,
  MessageAttributesType,
} from '../model-types.d';
import { getSource, getSourceDevice, getSourceUuid } from '../messages/helpers';
import { isDirectConversation, isGroupV2 } from './whatTypeOfConversation';

export function getMessageIdForLogging(message: MessageAttributesType): string {
  const account = getSourceUuid(message) || getSource(message);
  const device = getSourceDevice(message);
  const timestamp = message.sent_at;

  return `${account}.${device} ${timestamp}`;
}

export function getConversationIdForLogging(
  conversation: ConversationAttributesType
): string {
  if (isDirectConversation(conversation)) {
    const { uuid, e164, id } = conversation;
    return `${uuid || e164} (${id})`;
  }
  if (isGroupV2(conversation)) {
    return `groupv2(${conversation.groupId})`;
  }

  return `group(${conversation.groupId})`;
}
