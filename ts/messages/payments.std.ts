// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Payments feature removed for Orbital
// This file provides stub functions to maintain compatibility

import type { AnyPaymentEvent } from '../types/Payment.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';

export type MessageAttributesWithPaymentEvent = MessageAttributesType & {
  payment: AnyPaymentEvent;
};

export function messageHasPaymentEvent(_attributes: any): boolean {
  return false;
}

export function getPaymentEventNotificationText(
  _payment: AnyPaymentEvent,
  _senderTitle: string,
  _conversationTitle: string,
  _i18n: any,
  _isFromMe?: boolean
): string {
  return '';
}

export function getPaymentEventDescription(
  _payment: AnyPaymentEvent,
  _senderTitle: string,
  _conversationTitle: string,
  _i18n: any,
  _isMe?: boolean
): string {
  return '';
}
