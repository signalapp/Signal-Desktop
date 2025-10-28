// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString } from '../types/ServiceId.std.js';
import { strictAssert } from './assert.std.js';

export function startConversation(
  e164: string,
  serviceId: ServiceIdString
): void {
  const conversation = window.ConversationController.lookupOrCreate({
    e164,
    serviceId,
    reason: 'util/startConversation',
  });
  strictAssert(
    conversation,
    `startConversation failed given ${e164}/${serviceId} combination`
  );

  window.reduxActions.conversations.showConversation({
    conversationId: conversation.id,
  });
}
