// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { StateType } from '../reducer';
import type { ChatFoldersState } from '../ducks/chatFolders';

export function getChatFoldersState(state: StateType): ChatFoldersState {
  return state.chatFolders;
}

export const getCurrentChatFolders = createSelector(
  getChatFoldersState,
  state => {
    return state.currentChatFolders;
  }
);
