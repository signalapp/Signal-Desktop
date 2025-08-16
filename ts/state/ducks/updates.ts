// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import * as updateIpc from '../../shims/updateIpc';
import { DialogType } from '../../types/Dialogs';
import { DAY } from '../../util/durations';
import type { StateType as RootStateType } from '../reducer';

// State

export type UpdatesStateType = ReadonlyDeep<{
  dialogType: DialogType;
  didSnooze: boolean;
  downloadSize?: number;
  downloadedSize?: number;
  showEventsCount: number;
  isCheckingForUpdates: boolean;
  version?: string;
}>;

// Actions

const DISMISS_DIALOG = 'updates/DISMISS_DIALOG';
const SHOW_UPDATE_DIALOG = 'updates/SHOW_UPDATE_DIALOG';
const SNOOZE_UPDATE = 'updates/SNOOZE_UPDATE';
const START_UPDATE = 'updates/START_UPDATE';
const CHECK_FOR_UPDATES = 'updates/CHECK_FOR_UPDATES';
const CHECK_FOR_UPDATES_FINISHED = 'updates/CHECK_FOR_UPDATES_FINISHED';
const UNSNOOZE_UPDATE = 'updates/UNSNOOZE_UPDATE';

export type UpdateDialogOptionsType = ReadonlyDeep<{
  downloadSize?: number;
  downloadedSize?: number;
  version?: string;
}>;

type DismissDialogActionType = ReadonlyDeep<{
  type: typeof DISMISS_DIALOG;
}>;

export type ShowUpdateDialogActionType = ReadonlyDeep<{
  type: typeof SHOW_UPDATE_DIALOG;
  payload: {
    dialogType: DialogType;
    otherState: UpdateDialogOptionsType;
  };
}>;

type SnoozeUpdateActionType = ReadonlyDeep<{
  type: typeof SNOOZE_UPDATE;
}>;

type StartUpdateActionType = ReadonlyDeep<{
  type: typeof START_UPDATE;
}>;

type CheckForUpdatesActionType = ReadonlyDeep<{
  type: typeof CHECK_FOR_UPDATES;
}>;

type CheckForUpdatesFinishedActionType = ReadonlyDeep<{
  type: typeof CHECK_FOR_UPDATES_FINISHED;
}>;

type UnsnoozeUpdateActionType = ReadonlyDeep<{
  type: typeof UNSNOOZE_UPDATE;
  payload: DialogType;
}>;

export type UpdatesActionType = ReadonlyDeep<
  | DismissDialogActionType
  | ShowUpdateDialogActionType
  | SnoozeUpdateActionType
  | StartUpdateActionType
  | CheckForUpdatesActionType
  | CheckForUpdatesFinishedActionType
  | UnsnoozeUpdateActionType
>;

// Action Creators

function dismissDialog(): DismissDialogActionType {
  return {
    type: DISMISS_DIALOG,
  };
}

function showUpdateDialog(
  dialogType: DialogType,
  updateDialogOptions: UpdateDialogOptionsType = {}
): ShowUpdateDialogActionType {
  return {
    type: SHOW_UPDATE_DIALOG,
    payload: {
      dialogType,
      otherState: updateDialogOptions,
    },
  };
}

function snoozeUpdate(): ThunkAction<
  void,
  RootStateType,
  unknown,
  SnoozeUpdateActionType | UnsnoozeUpdateActionType
> {
  return (dispatch, getState) => {
    const { dialogType } = getState().updates;
    setTimeout(() => {
      dispatch({
        type: UNSNOOZE_UPDATE,
        payload: dialogType,
      });
    }, DAY);

    dispatch({
      type: SNOOZE_UPDATE,
    });
  };
}

function startUpdate(): ThunkAction<
  void,
  RootStateType,
  unknown,
  StartUpdateActionType | ShowUpdateDialogActionType
> {
  return async dispatch => {
    dispatch({
      type: START_UPDATE,
    });

    try {
      await updateIpc.startUpdate();
    } catch (_) {
      dispatch({
        type: SHOW_UPDATE_DIALOG,
        payload: {
          dialogType: DialogType.Cannot_Update,
          otherState: {},
        },
      });
    }
  };
}

function forceUpdate(): ThunkAction<
  void,
  RootStateType,
  unknown,
  | CheckForUpdatesActionType
  | CheckForUpdatesFinishedActionType
  | ShowUpdateDialogActionType
> {
  return async dispatch => {
    dispatch({
      type: CHECK_FOR_UPDATES,
    });

    try {
      await updateIpc.forceUpdate();
    } catch {
      dispatch({
        type: SHOW_UPDATE_DIALOG,
        payload: {
          dialogType: DialogType.Cannot_Update,
          otherState: {},
        },
      });
    } finally {
      dispatch({
        type: CHECK_FOR_UPDATES_FINISHED,
      });
    }
  };
}

export const actions = {
  dismissDialog,
  showUpdateDialog,
  snoozeUpdate,
  startUpdate,
  forceUpdate,
};

export const useUpdatesActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

// Reducer

export function getEmptyState(): UpdatesStateType {
  return {
    dialogType: DialogType.None,
    didSnooze: false,
    isCheckingForUpdates: false,
    showEventsCount: 0,
  };
}

export function reducer(
  state: Readonly<UpdatesStateType> = getEmptyState(),
  action: Readonly<UpdatesActionType>
): UpdatesStateType {
  if (action.type === SHOW_UPDATE_DIALOG) {
    const { dialogType, otherState } = action.payload;

    return {
      ...state,
      ...otherState,
      dialogType,
      showEventsCount: state.showEventsCount + 1,
    };
  }

  if (action.type === SNOOZE_UPDATE) {
    return {
      ...state,
      dialogType: DialogType.None,
      didSnooze: true,
    };
  }

  if (action.type === START_UPDATE) {
    return {
      ...state,
      dialogType: DialogType.None,
      didSnooze: false,
    };
  }

  if (action.type === CHECK_FOR_UPDATES) {
    return {
      ...state,
      dialogType: DialogType.None,
      didSnooze: false,
      isCheckingForUpdates: true,
    };
  }

  if (action.type === CHECK_FOR_UPDATES_FINISHED) {
    return {
      ...state,
      isCheckingForUpdates: false,
    };
  }

  if (
    action.type === DISMISS_DIALOG &&
    state.dialogType === DialogType.MacOS_Read_Only
  ) {
    return {
      ...state,
      dialogType: DialogType.None,
    };
  }

  if (action.type === UNSNOOZE_UPDATE) {
    return {
      ...state,
      dialogType: action.payload,
      didSnooze: false,
    };
  }

  return state;
}
