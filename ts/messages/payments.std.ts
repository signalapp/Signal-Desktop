// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Payments feature removed
// This file exists as a stub to prevent import errors during the transition

import type { AnyPaymentEvent } from '../types/Payment.std.js';
import type { LocalizerType } from '../types/Util.std.js';

export type MessageAttributesWithPaymentEvent = {
  payment?: AnyPaymentEvent;
};

export function messageHasPaymentEvent(
  _message: MessageAttributesWithPaymentEvent
): boolean {
  return false;
}

export function getPaymentEventDescription(
  _event: AnyPaymentEvent,
  _senderTitle: string,
  _conversationTitle: string | null,
  _i18n: LocalizerType,
  _isGroup: boolean
): string {
  // Return empty string for stub
  return '';
}

export function getPaymentEventNotificationText(
  _event: AnyPaymentEvent,
  _senderTitle: string,
  _conversationTitle: string | null,
  _i18n: LocalizerType,
  _isGroup: boolean
): string {
  // Return empty string for stub
  return '';
}
