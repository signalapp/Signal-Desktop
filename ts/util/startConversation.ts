// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UUIDStringType } from '../types/UUID';
import { strictAssert } from './assert';

export function startConversation(e164: string, uuid: UUIDStringType): void {
  const conversation = window.ConversationController.lookupOrCreate({
    e164,
    uuid,
    reason: 'util/startConversation',
  });
  strictAssert(
    conversation,
    `startConversation failed given ${e164}/${uuid} combination`
  );

  window.reduxActions.conversations.showConversation({
    conversationId: conversation.id,
  });
}
