// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import type { ConversationModel } from '../models/conversations';
import type {
  CustomError,
  MessageAttributesType,
  QuotedAttachmentType,
  QuotedMessageType,
} from '../model-types.d';
import type { ServiceIdString } from '../types/ServiceId';
import { PaymentEventKind } from '../types/Payment';
import type { AnyPaymentEvent } from '../types/Payment';
import type { LocalizerType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';

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

export type MessageAttributesWithPaymentEvent = MessageAttributesType & {
  payment: AnyPaymentEvent;
};

export function messageHasPaymentEvent(
  message: MessageAttributesType
): message is MessageAttributesWithPaymentEvent {
  return message.payment != null;
}

export function getPaymentEventNotificationText(
  payment: AnyPaymentEvent,
  senderTitle: string,
  conversationTitle: string | null,
  senderIsMe: boolean,
  i18n: LocalizerType
): string {
  if (payment.kind === PaymentEventKind.Notification) {
    return i18n('icu:payment-event-notification-label');
  }
  return getPaymentEventDescription(
    payment,
    senderTitle,
    conversationTitle,
    senderIsMe,
    i18n
  );
}

export function getPaymentEventDescription(
  payment: AnyPaymentEvent,
  senderTitle: string,
  conversationTitle: string | null,
  senderIsMe: boolean,
  i18n: LocalizerType
): string {
  const { kind } = payment;
  if (kind === PaymentEventKind.Notification) {
    if (senderIsMe) {
      if (conversationTitle != null) {
        return i18n('icu:payment-event-notification-message-you-label', {
          receiver: conversationTitle,
        });
      }
      return i18n(
        'icu:payment-event-notification-message-you-label-without-receiver'
      );
    }
    return i18n('icu:payment-event-notification-message-label', {
      sender: senderTitle,
    });
  }
  if (kind === PaymentEventKind.ActivationRequest) {
    if (senderIsMe) {
      if (conversationTitle != null) {
        return i18n('icu:payment-event-activation-request-you-label', {
          receiver: conversationTitle,
        });
      }
      return i18n(
        'icu:payment-event-activation-request-you-label-without-receiver'
      );
    }
    return i18n('icu:payment-event-activation-request-label', {
      sender: senderTitle,
    });
  }
  if (kind === PaymentEventKind.Activation) {
    if (senderIsMe) {
      return i18n('icu:payment-event-activated-you-label');
    }
    return i18n('icu:payment-event-activated-label', {
      sender: senderTitle,
    });
  }
  throw missingCaseError(kind);
}

export function isQuoteAMatch(
  message: MessageAttributesType | null | undefined,
  conversationId: string,
  quote: Pick<QuotedMessageType, 'id' | 'authorAci' | 'author'>
): message is MessageAttributesType {
  if (!message) {
    return false;
  }

  const { authorAci, id } = quote;
  const authorConversation = window.ConversationController.lookupOrCreate({
    e164: 'author' in quote ? quote.author : undefined,
    serviceId: authorAci,
    reason: 'helpers.isQuoteAMatch',
  });

  const isSameTimestamp =
    message.sent_at === id ||
    message.editHistory?.some(({ timestamp }) => timestamp === id) ||
    false;

  return (
    isSameTimestamp &&
    message.conversationId === conversationId &&
    getAuthorId(message) === authorConversation?.id
  );
}

export const shouldTryToCopyFromQuotedMessage = ({
  referencedMessageNotFound,
  quoteAttachment,
}: {
  referencedMessageNotFound: boolean;
  quoteAttachment: QuotedAttachmentType | undefined;
}): boolean => {
  // If we've tried and can't find the message, try again.
  if (referencedMessageNotFound === true) {
    return true;
  }

  // Otherwise, try again in case we have not yet copied over the thumbnail from the
  // original attachment (maybe it had not been downloaded when we first checked)
  if (!quoteAttachment?.thumbnail) {
    return false;
  }

  if (quoteAttachment.thumbnail.copied === true) {
    return false;
  }

  return true;
};

export function getAuthorId(
  message: Pick<MessageAttributesType, 'type' | 'source' | 'sourceServiceId'>
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
  message: MessageAttributesType
): ConversationModel | undefined {
  const id = getAuthorId(message);
  return window.ConversationController.get(id);
}

export function getSource(
  message: Pick<MessageAttributesType, 'type' | 'source'>
): string | undefined {
  if (isIncoming(message) || isStory(message)) {
    return message.source;
  }
  if (!isOutgoing(message)) {
    log.warn('Message.getSource: Called for non-incoming/non-outgoing message');
  }

  return window.textsecure.storage.user.getNumber();
}

export function getSourceDevice(
  message: Pick<MessageAttributesType, 'type' | 'sourceDevice'>
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

export function getSourceServiceId(
  message: Pick<MessageAttributesType, 'type' | 'sourceServiceId'>
): ServiceIdString | undefined {
  if (isIncoming(message) || isStory(message)) {
    return message.sourceServiceId;
  }
  if (!isOutgoing(message)) {
    log.warn(
      'Message.getSourceServiceId: Called for non-incoming/non-outgoing message'
    );
  }

  return window.textsecure.storage.user.getAci();
}

export const isCustomError = (e: unknown): e is CustomError =>
  e instanceof Error;
