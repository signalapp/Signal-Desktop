// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type { NoopActionType } from './noop';
import type { ReplacementValuesType } from '../../types/Util';
import { useBoundActions } from '../../hooks/useBoundActions';

export enum ToastType {
  AddingUserToGroup = 'AddingUserToGroup',
  Blocked = 'Blocked',
  BlockedGroup = 'BlockedGroup',
  CannotMixMultiAndNonMultiAttachments = 'CannotMixMultiAndNonMultiAttachments',
  CannotStartGroupCall = 'CannotStartGroupCall',
  CopiedUsername = 'CopiedUsername',
  CopiedUsernameLink = 'CopiedUsernameLink',
  DangerousFileType = 'DangerousFileType',
  DeleteForEveryoneFailed = 'DeleteForEveryoneFailed',
  Error = 'Error',
  Expired = 'Expired',
  FailedToDeleteUsername = 'FailedToDeleteUsername',
  FileSaved = 'FileSaved',
  FileSize = 'FileSize',
  InvalidConversation = 'InvalidConversation',
  LeftGroup = 'LeftGroup',
  MaxAttachments = 'MaxAttachments',
  MessageBodyTooLong = 'MessageBodyTooLong',
  PinnedConversationsFull = 'PinnedConversationsFull',
  ReportedSpamAndBlocked = 'ReportedSpamAndBlocked',
  StoryMuted = 'StoryMuted',
  StoryReact = 'StoryReact',
  StoryReply = 'StoryReply',
  StoryVideoError = 'StoryVideoError',
  StoryVideoTooLong = 'StoryVideoTooLong',
  StoryVideoUnsupported = 'StoryVideoUnsupported',
  UnableToLoadAttachment = 'UnableToLoadAttachment',
  UnsupportedMultiAttachment = 'UnsupportedMultiAttachment',
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

function openFileInFolder(target: string): NoopActionType {
  ipcRenderer.send('show-item-in-folder', target);
  return {
    type: 'NOOP',
    payload: null,
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
