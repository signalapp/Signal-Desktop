// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ConversationAttributesType,
  MessageAttributesType,
} from '../model-types.d';
import {
  getSource,
  getSourceDevice,
  getSourceServiceId,
} from '../messages/helpers';
import { isDirectConversation, isGroupV2 } from './whatTypeOfConversation';

export function getMessageIdForLogging(
  message: Pick<
    MessageAttributesType,
    'type' | 'sourceServiceId' | 'sourceDevice' | 'sent_at'
  >
): string {
  const account = getSourceServiceId(message) || getSource(message);
  const device = getSourceDevice(message);
  const timestamp = message.sent_at;

  return `${account}.${device} ${timestamp}`;
}

export function getConversationIdForLogging(
  conversation: ConversationAttributesType
): string {
  if (isDirectConversation(conversation)) {
    const { serviceId, pni, e164, id } = conversation;
    return `${serviceId || pni || e164} (${id})`;
  }
  if (isGroupV2(conversation)) {
    return `groupv2(${conversation.groupId})`;
  }

  return `group(${conversation.groupId})`;
}
