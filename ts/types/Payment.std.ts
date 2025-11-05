// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Payments feature removed
// This file exists as a stub to prevent import errors during the transition

export enum PaymentEventKind {
  Notification = 1,
  ActivationRequest = 2,
  Activation = 3,
}

export type PaymentNotificationEvent = Readonly<{
  kind: PaymentEventKind.Notification;
  note: string | null;
  transactionDetailsBase64?: string;
  amountMob?: string;
  feeMob?: string;
}>;

export type PaymentActivationRequestEvent = Readonly<{
  kind: PaymentEventKind.ActivationRequest;
}>;

export type PaymentActivatedEvent = Readonly<{
  kind: PaymentEventKind.Activation;
}>;

export type AnyPaymentEvent =
  | PaymentNotificationEvent
  | PaymentActivationRequestEvent
  | PaymentActivatedEvent;

export function isPaymentNotificationEvent(
  event: AnyPaymentEvent
): event is PaymentNotificationEvent {
  return event.kind === PaymentEventKind.Notification;
}
