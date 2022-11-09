// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { SIGNAL_ACI } from '../types/SignalConversation';

export function isSignalConversation(conversation: {
  id: string;
  uuid?: string;
}): boolean {
  const { id, uuid } = conversation;

  if (uuid) {
    return uuid === SIGNAL_ACI;
  }

  return window.ConversationController.isSignalConversation(id);
}
