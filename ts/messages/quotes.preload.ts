// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

import type {
  ReadonlyMessageAttributesType,
  QuotedMessageType,
} from '../model-types.std.ts';
import { getSourceServiceId } from './sources.preload.ts';
import {
  isDirectConversation,
  isGroupV2,
} from '../util/whatTypeOfConversation.dom.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

export function isQuoteAMatch({
  candidateQuotedMessage,
  quotingConversationId,
  quotingMessageType,
  quote,
}: {
  candidateQuotedMessage: ReadonlyMessageAttributesType | null | undefined;
  quotingConversationId: string;
  quotingMessageType: ReadonlyMessageAttributesType['type'];
  quote: ReadonlyDeep<
    Pick<
      QuotedMessageType,
      'id' | 'authorAci' | 'groupId' | 'isPrivateReplyGroupUnknown'
    >
  >;
}): boolean {
  if (!candidateQuotedMessage) {
    return false;
  }

  if (quote.isPrivateReplyGroupUnknown) {
    return false;
  }

  if (quotingMessageType !== 'incoming' && quotingMessageType !== 'outgoing') {
    return false;
  }

  const { authorAci, id, groupId } = quote;

  const isSameTimestamp =
    candidateQuotedMessage.sent_at === id ||
    candidateQuotedMessage.editHistory?.some(
      ({ timestamp }) => timestamp === id
    ) ||
    false;

  if (!isSameTimestamp) {
    return false;
  }

  if (!authorAci) {
    return false;
  }

  if (getSourceServiceId(candidateQuotedMessage) !== authorAci) {
    return false;
  }

  if (groupId) {
    const quotedGroup = window.ConversationController.get(groupId);
    if (quotedGroup == null) {
      return false;
    }
    if (!isGroupV2(quotedGroup.attributes)) {
      return false;
    }
    if (quotedGroup.attributes.groupId !== groupId) {
      return false;
    }

    if (candidateQuotedMessage.conversationId !== quotedGroup.id) {
      return false;
    }

    const quotingConversation = window.ConversationController.get(
      quotingConversationId
    );
    if (quotingConversation == null) {
      return false;
    }
    if (!isDirectConversation(quotingConversation.attributes)) {
      return false;
    }

    // if it's an incoming message, the quote must be authored by you
    if (quotingMessageType === 'incoming') {
      return authorAci === itemStorage.user.getAci();
    }

    // if it's an outgoing message, the quote must be authored by the other person in the conversation
    return authorAci === quotingConversation.getServiceId();
  }

  // For a direct reply, the conversation of the message must match the quoted conversation
  return candidateQuotedMessage.conversationId === quotingConversationId;
}
