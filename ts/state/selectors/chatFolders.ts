// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { StateType } from '../reducer.js';
import type { StateSelector } from '../types.js';
import type { ChatFoldersState } from '../ducks/chatFolders.js';
import type { CurrentChatFolders, ChatFolder } from '../../types/ChatFolder.js';
import {
  getSortedCurrentChatFolders,
  lookupCurrentChatFolder,
} from '../../types/ChatFolder.js';

export function getChatFoldersState(state: StateType): ChatFoldersState {
  return state.chatFolders;
}

export const getCurrentChatFolders: StateSelector<CurrentChatFolders> =
  createSelector(getChatFoldersState, state => {
    return state.currentChatFolders;
  });

export const getSortedChatFolders: StateSelector<ReadonlyArray<ChatFolder>> =
  createSelector(getCurrentChatFolders, currentChatFolders => {
    return getSortedCurrentChatFolders(currentChatFolders);
  });

export const getSelectedChatFolder: StateSelector<ChatFolder | null> =
  createSelector(
    getChatFoldersState,
    getCurrentChatFolders,
    (state, currentChatFolders) => {
      const selectedChatFolderId =
        state.selectedChatFolderId ?? currentChatFolders.order.at(0);
      if (selectedChatFolderId == null) {
        return null;
      }
      return lookupCurrentChatFolder(currentChatFolders, selectedChatFolderId);
    }
  );

export const getStableSelectedConversationIdInChatFolder: StateSelector<
  string | null
> = createSelector(getChatFoldersState, state => {
  return state.stableSelectedConversationIdInChatFolder;
});
