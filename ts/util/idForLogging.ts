// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ConversationAttributesType,
  ReadonlyMessageAttributesType,
} from '../model-types.d';
import {
  getSource,
  getSourceDevice,
  getSourceServiceId,
} from '../messages/helpers';
import { isDirectConversation, isGroupV2 } from './whatTypeOfConversation';
import { getE164 } from './getE164';
import type { ConversationType } from '../state/ducks/conversations';

export function getMessageIdForLogging(
  message: Pick<
    ReadonlyMessageAttributesType,
    'type' | 'sourceServiceId' | 'sourceDevice' | 'sent_at'
  >
): string {
  const account = getSourceServiceId(message) || getSource(message);
  const device = getSourceDevice(message);
  const timestamp = message.sent_at;

  return `${account}.${device} ${timestamp}`;
}

export function getConversationIdForLogging(
  conversation: ConversationAttributesType | ConversationType
): string {
  if (isDirectConversation(conversation)) {
    const { serviceId, pni, id } = conversation;
    return `${serviceId || pni || getE164(conversation)} (${id})`;
  }
  if (isGroupV2(conversation)) {
    return `groupv2(${conversation.groupId})`;
  }

  return `group(${conversation.groupId})`;
}
