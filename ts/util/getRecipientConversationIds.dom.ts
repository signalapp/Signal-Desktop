// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';

import { getRecipients } from './getRecipients.dom.js';
import { strictAssert } from './assert.std.js';

// Recipients includes only the people we'll actually send to for this conversation
export function getRecipientConversationIds(
  conversationAttrs: ConversationAttributesType
): Set<string> {
  const recipients = getRecipients(conversationAttrs);
  const conversationIds = recipients.map(identifier => {
    const conversation = window.ConversationController.getOrCreate(
      identifier,
      'private'
    );
    strictAssert(
      conversation,
      'getRecipientConversationIds should have created conversation!'
    );
    return conversation.id;
  });

  return new Set(conversationIds);
}
