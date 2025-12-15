// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { PinnedMessageRenderData } from '../../types/PinnedMessage.std.js';
import type { PinnedMessagesState } from '../ducks/pinnedMessages.preload.js';
import type { StateType } from '../reducer.preload.js';
import type { StateSelector } from '../types.std.js';
import { getSelectedConversationId } from './conversations.dom.js';
import { softAssert } from '../../util/assert.std.js';

export function getPinnedMessagesState(state: StateType): PinnedMessagesState {
  return state.pinnedMessages;
}

export const getPinnedMessages: StateSelector<
  ReadonlyArray<PinnedMessageRenderData>
> = createSelector(
  getPinnedMessagesState,
  getSelectedConversationId,
  (state, selectedConversationId) => {
    const expectedConversationId = selectedConversationId ?? null;
    if (expectedConversationId !== state.conversationId) {
      softAssert(
        false,
        'getPinnedMessages: State is not in sync with the selected conversation'
      );
      return [];
    }
    return state.pinnedMessages ?? [];
  }
);

export const getPinnedMessagesMessageIds: StateSelector<ReadonlyArray<string>> =
  createSelector(getPinnedMessages, pinnedMessages => {
    return pinnedMessages.map(pinnedMessage => {
      return pinnedMessage.message.id;
    });
  });
