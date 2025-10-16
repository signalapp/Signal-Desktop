// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import type { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem.dom.js';
import { isConversationUnread } from '../../util/isConversationUnread.std.js';
import type { ToFindType } from './LeftPaneHelper.dom.js';
import { FindDirection } from './LeftPaneHelper.dom.js';

const { find: findFirst, findLast, first, last } = lodash;

/**
 * This will look up or down in an array of conversations for the next one to select.
 * Refer to the tests for the intended behavior.
 */
export const getConversationInDirection = (
  conversations: ReadonlyArray<ConversationListItemPropsType>,
  toFind: Readonly<ToFindType>,
  selectedConversationId: undefined | string
): undefined | { conversationId: string } => {
  // As an optimization, we don't need to search if no conversation is selected.
  const selectedConversationIndex = selectedConversationId
    ? conversations.findIndex(({ id }) => id === selectedConversationId)
    : -1;

  let conversation: ConversationListItemPropsType | undefined;

  if (selectedConversationIndex < 0) {
    if (toFind.unreadOnly) {
      conversation =
        toFind.direction === FindDirection.Up
          ? findLast(conversations, isConversationUnread)
          : findFirst(conversations, isConversationUnread);
    } else {
      conversation =
        toFind.direction === FindDirection.Up
          ? last(conversations)
          : first(conversations);
    }
  } else if (toFind.unreadOnly) {
    conversation =
      toFind.direction === FindDirection.Up
        ? findLast(
            conversations.slice(0, selectedConversationIndex),
            isConversationUnread
          )
        : findFirst(
            conversations.slice(selectedConversationIndex + 1),
            isConversationUnread
          );
  } else {
    const newIndex =
      selectedConversationIndex +
      (toFind.direction === FindDirection.Up ? -1 : 1);
    if (newIndex < 0) {
      conversation = last(conversations);
    } else if (newIndex >= conversations.length) {
      conversation = first(conversations);
    } else {
      conversation = conversations[newIndex];
    }
  }

  return conversation ? { conversationId: conversation.id } : undefined;
};
