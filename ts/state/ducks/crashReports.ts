// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import { ToastType } from '../../types/Toast';
import type { StateType as RootStateType } from '../reducer';
import { showToast } from './toast';
import type { ShowToastActionType } from './toast';
import type { PromiseAction } from '../util';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

// State

export type CrashReportsStateType = ReadonlyDeep<{
  count: number;
  isPending: boolean;
}>;

// Actions

const SET_COUNT = 'crashReports/SET_COUNT';
const WRITE_TO_LOG = 'crashReports/WRITE_TO_LOG';
const ERASE = 'crashReports/ERASE';

type SetCrashReportCountActionType = ReadonlyDeep<{
  type: typeof SET_COUNT;
  payload: number;
}>;

type CrashReportsActionType = ReadonlyDeep<
  | SetCrashReportCountActionType
  | PromiseAction<typeof WRITE_TO_LOG>
  | PromiseAction<typeof ERASE>
>;

// Action Creators

export const actions = {
  setCrashReportCount,
  writeCrashReportsToLog,
  eraseCrashReports,
};

export const useCrashReportsActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function setCrashReportCount(count: number): SetCrashReportCountActionType {
  return { type: SET_COUNT, payload: count };
}

function writeCrashReportsToLog(): ThunkAction<
  void,
  RootStateType,
  unknown,
  PromiseAction<typeof WRITE_TO_LOG> | ShowToastActionType
> {
  return dispatch => {
    async function run() {
      try {
        await window.IPC.crashReports.writeToLog();
      } catch (error) {
        dispatch(showToast({ toastType: ToastType.DebugLogError }));
        throw error;
      }
    }
    dispatch({ type: WRITE_TO_LOG, payload: run() });
  };
}

function eraseCrashReports(): ThunkAction<
  void,
  RootStateType,
  unknown,
  PromiseAction<typeof ERASE> | ShowToastActionType
> {
  return dispatch => {
    async function run() {
      try {
        await window.IPC.crashReports.erase();
      } catch (error) {
        dispatch(showToast({ toastType: ToastType.DebugLogError }));
        throw error;
      }
    }
    dispatch({ type: ERASE, payload: run() });
  };
}

// Reducer

export function getEmptyState(): CrashReportsStateType {
  return {
    count: 0,
    isPending: false,
  };
}

export function reducer(
  state: Readonly<CrashReportsStateType> = getEmptyState(),
  action: Readonly<CrashReportsActionType>
): CrashReportsStateType {
  if (action.type === SET_COUNT) {
    return {
      ...state,
      count: action.payload,
    };
  }

  if (
    action.type === `${WRITE_TO_LOG}_PENDING` ||
    action.type === `${ERASE}_PENDING`
  ) {
    return {
      ...state,
      isPending: true,
    };
  }

  if (
    action.type === `${WRITE_TO_LOG}_FULFILLED` ||
    action.type === `${ERASE}_FULFILLED`
  ) {
    return {
      ...state,
      count: 0,
      isPending: false,
    };
  }

  if (
    action.type === (`${WRITE_TO_LOG}_REJECTED` as const) ||
    action.type === (`${ERASE}_REJECTED` as const)
  ) {
    const { error } = action;

    log.error(
      `Failed to write crash report due to error ${Errors.toLogFormat(error)}`
    );

    return {
      ...state,
      count: 0,
      isPending: false,
    };
  }

  return state;
}
