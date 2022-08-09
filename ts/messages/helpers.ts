// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import type { ConversationModel } from '../models/conversations';
import type {
  CustomError,
  MessageAttributesType,
  QuotedMessageType,
} from '../model-types.d';
import type { UUIDStringType } from '../types/UUID';

export function isIncoming(
  message: Pick<MessageAttributesType, 'type'>
): boolean {
  return message.type === 'incoming';
}

export function isOutgoing(
  message: Pick<MessageAttributesType, 'type'>
): boolean {
  return message.type === 'outgoing';
}

export function isStory(message: Pick<MessageAttributesType, 'type'>): boolean {
  return message.type === 'story';
}

export function isQuoteAMatch(
  message: MessageAttributesType | null | undefined,
  conversationId: string,
  quote: QuotedMessageType
): message is MessageAttributesType {
  if (!message) {
    return false;
  }

  const { authorUuid, id } = quote;
  const authorConversation = window.ConversationController.lookupOrCreate({
    e164: 'author' in quote ? quote.author : undefined,
    uuid: authorUuid,
  });

  return (
    message.sent_at === id &&
    message.conversationId === conversationId &&
    getContactId(message) === authorConversation?.id
  );
}

export function getContactId(
  message: MessageAttributesType
): string | undefined {
  const source = getSource(message);
  const sourceUuid = getSourceUuid(message);

  if (!source && !sourceUuid) {
    return window.ConversationController.getOurConversationId();
  }

  const conversation = window.ConversationController.lookupOrCreate({
    e164: source,
    uuid: sourceUuid,
  });
  return conversation?.id;
}

export function getContact(
  message: MessageAttributesType
): ConversationModel | undefined {
  const id = getContactId(message);
  return window.ConversationController.get(id);
}

export function getSource(message: MessageAttributesType): string | undefined {
  if (isIncoming(message) || isStory(message)) {
    return message.source;
  }
  if (!isOutgoing(message)) {
    log.warn('Message.getSource: Called for non-incoming/non-outgoing message');
  }

  return window.textsecure.storage.user.getNumber();
}

export function getSourceDevice(
  message: MessageAttributesType
): string | number | undefined {
  const { sourceDevice } = message;

  if (isIncoming(message) || isStory(message)) {
    return sourceDevice;
  }
  if (!isOutgoing(message)) {
    log.warn(
      'Message.getSourceDevice: Called for non-incoming/non-outgoing message'
    );
  }

  return sourceDevice || window.textsecure.storage.user.getDeviceId();
}

export function getSourceUuid(
  message: MessageAttributesType
): UUIDStringType | undefined {
  if (isIncoming(message) || isStory(message)) {
    return message.sourceUuid;
  }
  if (!isOutgoing(message)) {
    log.warn(
      'Message.getSourceUuid: Called for non-incoming/non-outgoing message'
    );
  }

  return window.textsecure.storage.user.getUuid()?.toString();
}

export const isCustomError = (e: unknown): e is CustomError =>
  e instanceof Error;
