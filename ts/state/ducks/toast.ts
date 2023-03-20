// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type { NoopActionType } from './noop';
import type { ReplacementValuesType } from '../../types/Util';
import { useBoundActions } from '../../hooks/useBoundActions';
import type { ToastType } from '../../types/Toast';

// State

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type ToastStateType = {
  toast?: {
    toastType: ToastType;
    parameters?: ReplacementValuesType;
  };
};

// Actions

const HIDE_TOAST = 'toast/HIDE_TOAST';
export const SHOW_TOAST = 'toast/SHOW_TOAST';

type HideToastActionType = ReadonlyDeep<{
  type: typeof HIDE_TOAST;
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type ShowToastActionType = {
  type: typeof SHOW_TOAST;
  payload: {
    toastType: ToastType;
    parameters?: ReplacementValuesType;
  };
};

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type ToastActionType = HideToastActionType | ShowToastActionType;

// Action Creators

function hideToast(): HideToastActionType {
  return {
    type: HIDE_TOAST,
  };
}

function openFileInFolder(target: string): NoopActionType {
  ipcRenderer.send('show-item-in-folder', target);
  return {
    type: 'NOOP',
    payload: null,
  };
}

export type ShowToastActionCreatorType = ReadonlyDeep<
  (
    toastType: ToastType,
    parameters?: ReplacementValuesType
  ) => ShowToastActionType
>;

export type ShowToastAction = ReadonlyDeep<
  (toastType: ToastType, parameters?: ReplacementValuesType) => void
>;

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
