// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d.ts';

// The only part of the external-client bridge that Signal's message code
// calls into. Deliberately free of imports so the call sites gain no
// dependencies. Each call is a no-op unless the bridge's event source is
// installed and some client subscribed to messages.

export type ExternalClientMessageListenerType = Readonly<{
  added: (message: MessageAttributesType) => void;
  updated: (message: MessageAttributesType) => void;
  removed: (message: MessageAttributesType) => void;
}>;

let listener: ExternalClientMessageListenerType | undefined;

export function setExternalClientMessageListener(
  value: ExternalClientMessageListenerType | undefined
): void {
  listener = value;
}

// A message was added to a conversation's timeline (received or sent).
export function notifyExternalClientsMessageAdded(
  message: MessageAttributesType
): void {
  listener?.added(message);
}

// A message held in memory changed (edits, deletes for everyone, receipts,
// reactions, attachment downloads, expiry timers starting).
export function notifyExternalClientsMessageUpdated(
  message: MessageAttributesType
): void {
  listener?.updated(message);
}

// A message was deleted from this device.
export function notifyExternalClientsMessageRemoved(
  message: MessageAttributesType
): void {
  listener?.removed(message);
}

let notificationsHandledExternally = false;

export function setMessageNotificationsHandledExternally(value: boolean): void {
  notificationsHandledExternally = value;
}

// True while a connected app the user allowed to (notifications.manage)
// shows message notifications itself. Calls still notify in Signal.
export function areMessageNotificationsHandledExternally(): boolean {
  return notificationsHandledExternally;
}
