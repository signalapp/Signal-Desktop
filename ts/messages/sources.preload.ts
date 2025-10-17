// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import { createLogger } from '../logging/log.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import type { ConversationModel } from '../models/conversations.preload.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import { isIncoming, isOutgoing, isStory } from './helpers.std.js';

const log = createLogger('messages/sources');

export function getSource(
  message: Pick<ReadonlyMessageAttributesType, 'type' | 'source'>
): string | undefined {
  if (isIncoming(message) || isStory(message)) {
    return message.source;
  }
  if (!isOutgoing(message)) {
    log.warn('Message.getSource: Called for non-incoming/non-outgoing message');
  }

  return itemStorage.user.getNumber();
}

export function getSourceDevice(
  message: Pick<ReadonlyMessageAttributesType, 'type' | 'sourceDevice'>
): string | number | undefined {
  const { sourceDevice } = message;

  if (isIncoming(message) || isStory(message)) {
    return sourceDevice;
  }

  return sourceDevice || itemStorage.user.getDeviceId();
}

export function getSourceServiceId(
  message: Pick<ReadonlyMessageAttributesType, 'type' | 'sourceServiceId'>
): ServiceIdString | undefined {
  if (isIncoming(message) || isStory(message)) {
    return message.sourceServiceId;
  }

  return itemStorage.user.getAci();
}

export function getAuthorId(
  message: Pick<
    ReadonlyMessageAttributesType,
    'type' | 'source' | 'sourceServiceId'
  >
): string | undefined {
  const source = getSource(message);
  const sourceServiceId = getSourceServiceId(message);

  if (!source && !sourceServiceId) {
    return window.ConversationController.getOurConversationId();
  }

  const conversation = window.ConversationController.lookupOrCreate({
    e164: source,
    serviceId: sourceServiceId,
    reason: 'helpers.getAuthorId',
  });
  return conversation?.id;
}

export function getAuthor(
  message: ReadonlyMessageAttributesType
): ConversationModel | undefined {
  const id = getAuthorId(message);
  return window.ConversationController.get(id);
}
