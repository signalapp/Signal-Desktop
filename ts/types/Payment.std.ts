// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Payments feature removed for Orbital
// This file provides stub types to maintain compatibility

export enum PaymentEventKind {
  Notification = 'notification',
  Activation = 'activation',
  ActivationRequest = 'activationRequest',
}

export type PaymentEventData = {
  kind: PaymentEventKind;
  note?: string;
};

export type AnyPaymentEvent = PaymentEventData;

export function isPaymentNotificationEvent(_event: unknown): boolean {
  return false;
}

// Gift badge states enum (stub for removed feature)
export enum GiftBadgeStates {
  Failed = 'Failed',
  Pending = 'Pending',
  Redeemed = 'Redeemed',
}
