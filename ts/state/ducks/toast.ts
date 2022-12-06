// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useBoundActions } from '../../hooks/useBoundActions';
import type { ReplacementValuesType } from '../../types/Util';

export enum ToastType {
  AddingUserToGroup = 'AddingUserToGroup',
  CannotStartGroupCall = 'CannotStartGroupCall',
  CopiedUsername = 'CopiedUsername',
  CopiedUsernameLink = 'CopiedUsernameLink',
  DeleteForEveryoneFailed = 'DeleteForEveryoneFailed',
  Error = 'Error',
  FailedToDeleteUsername = 'FailedToDeleteUsername',
  MessageBodyTooLong = 'MessageBodyTooLong',
  ReportedSpamAndBlocked = 'ReportedSpamAndBlocked',
  StoryMuted = 'StoryMuted',
  StoryReact = 'StoryReact',
  StoryReply = 'StoryReply',
  StoryVideoError = 'StoryVideoError',
  StoryVideoTooLong = 'StoryVideoTooLong',
  StoryVideoUnsupported = 'StoryVideoUnsupported',
  UserAddedToGroup = 'UserAddedToGroup',
}

// State

export type ToastStateType = {
  toast?: {
    toastType: ToastType;
    parameters?: ReplacementValuesType;
  };
};

// Actions

const HIDE_TOAST = 'toast/HIDE_TOAST';
export const SHOW_TOAST = 'toast/SHOW_TOAST';

type HideToastActionType = {
  type: typeof HIDE_TOAST;
};

export type ShowToastActionType = {
  type: typeof SHOW_TOAST;
  payload: {
    toastType: ToastType;
    parameters?: ReplacementValuesType;
  };
};

export type ToastActionType = HideToastActionType | ShowToastActionType;

// Action Creators

function hideToast(): HideToastActionType {
  return {
    type: HIDE_TOAST,
  };
}

export type ShowToastActionCreatorType = (
  toastType: ToastType,
  parameters?: ReplacementValuesType
) => ShowToastActionType;

export const showToast: ShowToastActionCreatorType = (
  toastType,
  parameters
) => {
  return {
    type: SHOW_TOAST,
    payload: {
      toastType,
      parameters,
    },
  };
};

export const actions = {
  hideToast,
  showToast,
};

export const useToastActions = (): typeof actions => useBoundActions(actions);

// Reducer

export function getEmptyState(): ToastStateType {
  return {};
}

export function reducer(
  state: Readonly<ToastStateType> = getEmptyState(),
  action: Readonly<ToastActionType>
): ToastStateType {
  if (action.type === HIDE_TOAST) {
    return {
      ...state,
      toast: undefined,
    };
  }

  if (action.type === SHOW_TOAST) {
    return {
      ...state,
      toast: action.payload,
    };
  }

  return state;
}
