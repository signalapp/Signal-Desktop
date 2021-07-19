// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// State

export type GlobalModalsStateType = {
  readonly isChatColorEditorVisible: boolean;
  readonly isProfileEditorVisible: boolean;
  readonly profileEditorHasError: boolean;
};

// Actions

const TOGGLE_CHAT_COLOR_EDITOR = 'globalModals/TOGGLE_CHAT_COLOR_EDITOR';
const TOGGLE_PROFILE_EDITOR = 'globalModals/TOGGLE_PROFILE_EDITOR';
export const TOGGLE_PROFILE_EDITOR_ERROR =
  'globalModals/TOGGLE_PROFILE_EDITOR_ERROR';

type ToggleChatColorEditorActionType = {
  type: typeof TOGGLE_CHAT_COLOR_EDITOR;
};

type ToggleProfileEditorActionType = {
  type: typeof TOGGLE_PROFILE_EDITOR;
};

export type ToggleProfileEditorErrorActionType = {
  type: typeof TOGGLE_PROFILE_EDITOR_ERROR;
};

export type GlobalModalsActionType =
  | ToggleChatColorEditorActionType
  | ToggleProfileEditorActionType
  | ToggleProfileEditorErrorActionType;

// Action Creators

export const actions = {
  toggleChatColorEditor,
  toggleProfileEditor,
  toggleProfileEditorHasError,
};

function toggleChatColorEditor(): ToggleChatColorEditorActionType {
  return { type: TOGGLE_CHAT_COLOR_EDITOR };
}

function toggleProfileEditor(): ToggleProfileEditorActionType {
  return { type: TOGGLE_PROFILE_EDITOR };
}

function toggleProfileEditorHasError(): ToggleProfileEditorErrorActionType {
  return { type: TOGGLE_PROFILE_EDITOR_ERROR };
}

// Reducer

export function getEmptyState(): GlobalModalsStateType {
  return {
    isChatColorEditorVisible: false,
    isProfileEditorVisible: false,
    profileEditorHasError: false,
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

  if (action.type === TOGGLE_PROFILE_EDITOR) {
    return {
      ...state,
      isProfileEditorVisible: !state.isProfileEditorVisible,
    };
  }

  if (action.type === TOGGLE_PROFILE_EDITOR_ERROR) {
    return {
      ...state,
      profileEditorHasError: !state.profileEditorHasError,
    };
  }

  return state;
}
