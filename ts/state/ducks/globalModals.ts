// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// State

export type GlobalModalsStateType = {
  readonly contactModalState?: ContactModalStateType;
  readonly isProfileEditorVisible: boolean;
  readonly isWhatsNewVisible: boolean;
  readonly profileEditorHasError: boolean;
  readonly safetyNumberModalContactId?: string;
  readonly usernameNotFoundModalState?: UsernameNotFoundModalStateType;
};

// Actions

const HIDE_CONTACT_MODAL = 'globalModals/HIDE_CONTACT_MODAL';
const SHOW_CONTACT_MODAL = 'globalModals/SHOW_CONTACT_MODAL';
const SHOW_WHATS_NEW_MODAL = 'globalModals/SHOW_WHATS_NEW_MODAL_MODAL';
const SHOW_USERNAME_NOT_FOUND_MODAL =
  'globalModals/SHOW_USERNAME_NOT_FOUND_MODAL';
const HIDE_USERNAME_NOT_FOUND_MODAL =
  'globalModals/HIDE_USERNAME_NOT_FOUND_MODAL';
const HIDE_WHATS_NEW_MODAL = 'globalModals/HIDE_WHATS_NEW_MODAL_MODAL';
const TOGGLE_PROFILE_EDITOR = 'globalModals/TOGGLE_PROFILE_EDITOR';
export const TOGGLE_PROFILE_EDITOR_ERROR =
  'globalModals/TOGGLE_PROFILE_EDITOR_ERROR';
const TOGGLE_SAFETY_NUMBER_MODAL = 'globalModals/TOGGLE_SAFETY_NUMBER_MODAL';

export type ContactModalStateType = {
  contactId: string;
  conversationId?: string;
};

export type UsernameNotFoundModalStateType = {
  username: string;
};

type HideContactModalActionType = {
  type: typeof HIDE_CONTACT_MODAL;
};

type ShowContactModalActionType = {
  type: typeof SHOW_CONTACT_MODAL;
  payload: ContactModalStateType;
};

type HideWhatsNewModalActionType = {
  type: typeof HIDE_WHATS_NEW_MODAL;
};

type ShowWhatsNewModalActionType = {
  type: typeof SHOW_WHATS_NEW_MODAL;
};

type HideUsernameNotFoundModalActionType = {
  type: typeof HIDE_USERNAME_NOT_FOUND_MODAL;
};

export type ShowUsernameNotFoundModalActionType = {
  type: typeof SHOW_USERNAME_NOT_FOUND_MODAL;
  payload: {
    username: string;
  };
};

type ToggleProfileEditorActionType = {
  type: typeof TOGGLE_PROFILE_EDITOR;
};

export type ToggleProfileEditorErrorActionType = {
  type: typeof TOGGLE_PROFILE_EDITOR_ERROR;
};

type ToggleSafetyNumberModalActionType = {
  type: typeof TOGGLE_SAFETY_NUMBER_MODAL;
  payload: string | undefined;
};

export type GlobalModalsActionType =
  | HideContactModalActionType
  | ShowContactModalActionType
  | HideWhatsNewModalActionType
  | ShowWhatsNewModalActionType
  | HideUsernameNotFoundModalActionType
  | ShowUsernameNotFoundModalActionType
  | ToggleProfileEditorActionType
  | ToggleProfileEditorErrorActionType
  | ToggleSafetyNumberModalActionType;

// Action Creators

export const actions = {
  hideContactModal,
  showContactModal,
  hideWhatsNewModal,
  showWhatsNewModal,
  hideUsernameNotFoundModal,
  showUsernameNotFoundModal,
  toggleProfileEditor,
  toggleProfileEditorHasError,
  toggleSafetyNumberModal,
};

function hideContactModal(): HideContactModalActionType {
  return {
    type: HIDE_CONTACT_MODAL,
  };
}

function showContactModal(
  contactId: string,
  conversationId?: string
): ShowContactModalActionType {
  return {
    type: SHOW_CONTACT_MODAL,
    payload: {
      contactId,
      conversationId,
    },
  };
}

function hideWhatsNewModal(): HideWhatsNewModalActionType {
  return {
    type: HIDE_WHATS_NEW_MODAL,
  };
}

function showWhatsNewModal(): ShowWhatsNewModalActionType {
  return {
    type: SHOW_WHATS_NEW_MODAL,
  };
}

function hideUsernameNotFoundModal(): HideUsernameNotFoundModalActionType {
  return {
    type: HIDE_USERNAME_NOT_FOUND_MODAL,
  };
}

function showUsernameNotFoundModal(
  username: string
): ShowUsernameNotFoundModalActionType {
  return {
    type: SHOW_USERNAME_NOT_FOUND_MODAL,
    payload: {
      username,
    },
  };
}

function toggleProfileEditor(): ToggleProfileEditorActionType {
  return { type: TOGGLE_PROFILE_EDITOR };
}

function toggleProfileEditorHasError(): ToggleProfileEditorErrorActionType {
  return { type: TOGGLE_PROFILE_EDITOR_ERROR };
}

function toggleSafetyNumberModal(
  safetyNumberModalContactId?: string
): ToggleSafetyNumberModalActionType {
  return {
    type: TOGGLE_SAFETY_NUMBER_MODAL,
    payload: safetyNumberModalContactId,
  };
}

// Reducer

export function getEmptyState(): GlobalModalsStateType {
  return {
    isProfileEditorVisible: false,
    profileEditorHasError: false,
    isWhatsNewVisible: false,
  };
}

export function reducer(
  state: Readonly<GlobalModalsStateType> = getEmptyState(),
  action: Readonly<GlobalModalsActionType>
): GlobalModalsStateType {
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

  if (action.type === SHOW_WHATS_NEW_MODAL) {
    return {
      ...state,
      isWhatsNewVisible: true,
    };
  }

  if (action.type === HIDE_WHATS_NEW_MODAL) {
    return {
      ...state,
      isWhatsNewVisible: false,
    };
  }

  if (action.type === HIDE_USERNAME_NOT_FOUND_MODAL) {
    return {
      ...state,
      usernameNotFoundModalState: undefined,
    };
  }

  if (action.type === SHOW_USERNAME_NOT_FOUND_MODAL) {
    const { username } = action.payload;

    return {
      ...state,
      usernameNotFoundModalState: {
        username,
      },
    };
  }

  if (action.type === SHOW_CONTACT_MODAL) {
    return {
      ...state,
      contactModalState: action.payload,
    };
  }

  if (action.type === HIDE_CONTACT_MODAL) {
    return {
      ...state,
      contactModalState: undefined,
    };
  }

  if (action.type === TOGGLE_SAFETY_NUMBER_MODAL) {
    return {
      ...state,
      safetyNumberModalContactId: action.payload,
    };
  }

  return state;
}
