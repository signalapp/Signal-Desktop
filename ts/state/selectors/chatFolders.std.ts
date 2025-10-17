// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { StateType } from '../reducer.preload.js';
import type { StateSelector } from '../types.std.js';
import type { ChatFoldersState } from '../ducks/chatFolders.preload.js';
import type { CurrentChatFolder } from '../../types/CurrentChatFolders.std.js';
import { CurrentChatFolders } from '../../types/CurrentChatFolders.std.js';

export function getChatFoldersState(state: StateType): ChatFoldersState {
  return state.chatFolders;
}

export const getCurrentChatFolders: StateSelector<CurrentChatFolders> =
  createSelector(getChatFoldersState, state => {
    return state.currentChatFolders;
  });

export const getCurrentChatFoldersCount: StateSelector<number> = createSelector(
  getCurrentChatFolders,
  currentChatFolders => {
    return CurrentChatFolders.size(currentChatFolders);
  }
);

export const getHasAnyCurrentCustomChatFolders: StateSelector<boolean> =
  createSelector(getCurrentChatFolders, currentChatFolders => {
    return currentChatFolders.hasAnyCurrentCustomChatFolders;
  });

export const getSelectedChatFolder: StateSelector<CurrentChatFolder | null> =
  createSelector(
    getChatFoldersState,
    getCurrentChatFolders,
    (state, currentChatFolders) => {
      const { selectedChatFolderId } = state;
      if (selectedChatFolderId == null) {
        return null;
      }
      return CurrentChatFolders.expect(
        currentChatFolders,
        selectedChatFolderId,
        'getSelectedChatFolder'
      );
    }
  );

export const getStableSelectedConversationIdInChatFolder: StateSelector<
  string | null
> = createSelector(getChatFoldersState, state => {
  return state.stableSelectedConversationIdInChatFolder;
});
