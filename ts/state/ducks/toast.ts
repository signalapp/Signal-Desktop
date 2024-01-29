// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type { NoopActionType } from './noop';
import { useBoundActions } from '../../hooks/useBoundActions';
import type { AnyToast } from '../../types/Toast';

// State

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type ToastStateType = {
  toast?: AnyToast;
};

// Actions

const HIDE_TOAST = 'toast/HIDE_TOAST';
export const SHOW_TOAST = 'toast/SHOW_TOAST';

type HideToastActionType = ReadonlyDeep<{
  type: typeof HIDE_TOAST;
  payload: AnyToast | undefined;
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type ShowToastActionType = {
  type: typeof SHOW_TOAST;
  payload: AnyToast;
};

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type ToastActionType = HideToastActionType | ShowToastActionType;

// Action Creators

export type HideToastAction = ReadonlyDeep<(toast?: AnyToast) => void>;

function hideToast(toast?: AnyToast): HideToastActionType {
  return {
    type: HIDE_TOAST,
    payload: toast,
  };
}

function openFileInFolder(target: string): NoopActionType {
  ipcRenderer.send('show-item-in-folder', target);
  return {
    type: 'NOOP',
    payload: null,
  };
}

export type ShowToastAction = ReadonlyDeep<(toast: AnyToast) => void>;

export function showToast(toast: AnyToast): ShowToastActionType {
  return {
    type: SHOW_TOAST,
    payload: toast,
  };
}

export const actions = {
  hideToast,
  openFileInFolder,
  showToast,
};

export const useToastActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

// Reducer

export function getEmptyState(): ToastStateType {
  return {};
}

export function reducer(
  state: Readonly<ToastStateType> = getEmptyState(),
  action: Readonly<ToastActionType>
): ToastStateType {
  if (action.type === HIDE_TOAST) {
    if (action.payload != null && state.toast !== action.payload) {
      return state;
    }

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
