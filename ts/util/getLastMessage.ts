// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { LastMessageType } from '../state/ducks/conversations';
import { dropNull } from './dropNull';
import { findAndFormatContact } from './findAndFormatContact';
import { hydrateRanges } from '../types/BodyRange';
import { stripNewlinesForLeftPane } from './stripNewlinesForLeftPane';

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
