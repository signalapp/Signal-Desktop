// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { LastMessageType } from '../state/ducks/conversations.preload.js';
import { dropNull } from './dropNull.std.js';
import { findAndFormatContact } from './findAndFormatContact.preload.js';
import { hydrateRanges } from '../types/BodyRange.std.js';
import { stripNewlinesForLeftPane } from './stripNewlinesForLeftPane.std.js';

export function getLastMessage(
  conversationAttrs: ConversationAttributesType
): LastMessageType | undefined {
  if (conversationAttrs.lastMessageDeletedForEveryone) {
    return { deletedForEveryone: true };
  }
  const lastMessageText = conversationAttrs.lastMessage;
  if (!lastMessageText) {
    return undefined;
  }

  const rawBodyRanges = conversationAttrs.lastMessageBodyRanges || [];
  const bodyRanges = hydrateRanges(rawBodyRanges, findAndFormatContact);

  const text = stripNewlinesForLeftPane(lastMessageText);
  const prefix = conversationAttrs.lastMessagePrefix;

  return {
    author: dropNull(conversationAttrs.lastMessageAuthor),
    bodyRanges,
    deletedForEveryone: false,
    prefix,
    status: dropNull(conversationAttrs.lastMessageStatus),
    text,
  };
}
