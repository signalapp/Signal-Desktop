// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useBoundActions } from '../../hooks/useBoundActions';

export enum ToastType {
  Error = 'Error',
  MessageBodyTooLong = 'MessageBodyTooLong',
  StoryMuted = 'StoryMuted',
  StoryReact = 'StoryReact',
  StoryReply = 'StoryReply',
}

// State

export type ToastStateType = {
  toastType?: ToastType;
};

// Actions

const HIDE_TOAST = 'toast/HIDE_TOAST';
const SHOW_TOAST = 'toast/SHOW_TOAST';

type HideToastActionType = {
  type: typeof HIDE_TOAST;
};

type ShowToastActionType = {
  type: typeof SHOW_TOAST;
  payload: ToastType;
};

export type ToastActionType = HideToastActionType | ShowToastActionType;

// Action Creators

function hideToast(): HideToastActionType {
  return {
    type: HIDE_TOAST,
  };
}

export type ShowToastActionCreatorType = (
  toastType: ToastType
) => ShowToastActionType;

const showToast: ShowToastActionCreatorType = toastType => {
  return {
    type: SHOW_TOAST,
    payload: toastType,
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
      toastType: undefined,
    };
  }

  if (action.type === SHOW_TOAST) {
    return {
      ...state,
      toastType: action.payload,
    };
  }

  return state;
}
