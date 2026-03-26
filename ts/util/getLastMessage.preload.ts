// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId.std.js';
import type { ConversationAttributesType } from '../model-types.d.ts';
import type { LastMessageType } from '../state/ducks/conversations.preload.js';
import { BodyRange } from '../types/BodyRange.std.js';
import { dropNull } from './dropNull.std.js';
import { findAndFormatContact } from './findAndFormatContact.preload.js';
import { hydrateRanges } from './BodyRange.node.js';
import { stripNewlinesForLeftPane } from './stripNewlinesForLeftPane.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import { getTitle } from './getTitle.preload.js';
import { isDirectConversation } from './whatTypeOfConversation.dom.js';

function getNameForAci(
  aci: AciString | null | undefined,
  options?: { isShort?: boolean }
): string | null {
  if (aci == null) {
    return null;
  }
  const conversation = window.ConversationController.get(aci);
  if (conversation != null) {
    return getTitle(conversation.attributes, options);
  }
  return null;
}

function getDisplayNameForAci(
  aci: AciString | null | undefined,
  ourAci: AciString | null | undefined
): string | null {
  if (aci === ourAci) {
    return window.SignalContext.i18n('icu:you');
  }
  return getNameForAci(aci, { isShort: true });
}

export function getLastMessage(
  conversationAttrs: ConversationAttributesType
): LastMessageType | undefined {
  const ourAci = itemStorage.user.getAci();

  if (conversationAttrs.lastMessageDeletedForEveryone) {
    const { lastMessageAuthorAci, lastMessageDeletedForEveryoneByAdminAci } =
      conversationAttrs;

    // Don't show admin name when the admin deleted their own message or when
    // the current user is the admin (show "You deleted this message" instead)
    const isAdminDeletingOwnMessage =
      lastMessageDeletedForEveryoneByAdminAci != null &&
      lastMessageDeletedForEveryoneByAdminAci === lastMessageAuthorAci;
    const isAdminMe =
      lastMessageDeletedForEveryoneByAdminAci != null &&
      lastMessageDeletedForEveryoneByAdminAci === ourAci;
    const deletedByAdminName =
      isAdminDeletingOwnMessage || isAdminMe
        ? null
        : getNameForAci(lastMessageDeletedForEveryoneByAdminAci);

    const authorName =
      getDisplayNameForAci(lastMessageAuthorAci, ourAci) ??
      // Deprecated: fall back to lastMessageAuthor from old database rows
      conversationAttrs.lastMessageAuthor ??
      null;

    return {
      deletedForEveryone: true,
      deletedByAdminName,
      isOutgoing: lastMessageAuthorAci === ourAci || isAdminMe,
      authorName,
    };
  }

  const lastMessageText = conversationAttrs.lastMessage;
  if (!lastMessageText) {
    return undefined;
  }

  const rawBodyRanges = conversationAttrs.lastMessageBodyRanges || [];
  const bodyRangesToHydrate = isDirectConversation(conversationAttrs)
    ? rawBodyRanges.filter(range => !BodyRange.isMention(range))
    : rawBodyRanges;
  const bodyRanges = hydrateRanges(bodyRangesToHydrate, findAndFormatContact);

  const text = stripNewlinesForLeftPane(lastMessageText);
  const prefix = conversationAttrs.lastMessagePrefix;

  const author =
    getDisplayNameForAci(conversationAttrs.lastMessageAuthorAci, ourAci) ??
    // Deprecated: fall back to lastMessageAuthor from old database rows
    conversationAttrs.lastMessageAuthor ??
    null;

  return {
    author,
    bodyRanges,
    deletedForEveryone: false,
    prefix,
    status: dropNull(conversationAttrs.lastMessageStatus),
    text,
  };
}
