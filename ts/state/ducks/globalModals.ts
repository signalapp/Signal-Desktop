// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// State

export type GlobalModalsStateType = {
  readonly isChatColorEditorVisible: boolean;
};

// Actions

const TOGGLE_CHAT_COLOR_EDITOR = 'globalModals/TOGGLE_CHAT_COLOR_EDITOR';

type ToggleChatColorEditorActionType = {
  type: typeof TOGGLE_CHAT_COLOR_EDITOR;
};

export type GlobalModalsActionType = ToggleChatColorEditorActionType;

// Action Creators

export const actions = {
  toggleChatColorEditor,
};

function toggleChatColorEditor(): ToggleChatColorEditorActionType {
  return { type: TOGGLE_CHAT_COLOR_EDITOR };
}

// Reducer

export function getEmptyState(): GlobalModalsStateType {
  return {
    isChatColorEditorVisible: false,
  };
}

export function reducer(
  state: Readonly<GlobalModalsStateType> = getEmptyState(),
  action: Readonly<GlobalModalsActionType>
): GlobalModalsStateType {
  if (action.type === TOGGLE_CHAT_COLOR_EDITOR) {
    return {
      ...state,
      isChatColorEditorVisible: !state.isChatColorEditorVisible,
    };
  }

  return state;
}
