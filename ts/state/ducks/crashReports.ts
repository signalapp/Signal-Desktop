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

// State

export type CrashReportsStateType = ReadonlyDeep<{
  count: number;
  isPending: boolean;
}>;

// Actions

const SET_COUNT = 'crashReports/SET_COUNT';
const UPLOAD = 'crashReports/UPLOAD';
const ERASE = 'crashReports/ERASE';

type SetCrashReportCountActionType = ReadonlyDeep<{
  type: typeof SET_COUNT;
  payload: number;
}>;

type CrashReportsActionType = ReadonlyDeep<
  | SetCrashReportCountActionType
  | PromiseAction<typeof UPLOAD>
  | PromiseAction<typeof ERASE>
>;

// Action Creators

export const actions = {
  setCrashReportCount,
  uploadCrashReports,
  eraseCrashReports,
};

function setCrashReportCount(count: number): SetCrashReportCountActionType {
  return { type: SET_COUNT, payload: count };
}

function uploadCrashReports(): ThunkAction<
  void,
  RootStateType,
  unknown,
  PromiseAction<typeof UPLOAD> | ShowToastActionType
> {
  return dispatch => {
    async function run() {
      try {
        await window.IPC.crashReports.upload();
        dispatch(showToast({ toastType: ToastType.LinkCopied }));
      } catch (error) {
        dispatch(showToast({ toastType: ToastType.DebugLogError }));
        throw error;
      }
    }
    dispatch({ type: UPLOAD, payload: run() });
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
    action.type === `${UPLOAD}_PENDING` ||
    action.type === `${ERASE}_PENDING`
  ) {
    return {
      ...state,
      isPending: true,
    };
  }

  if (
    action.type === `${UPLOAD}_FULFILLED` ||
    action.type === `${ERASE}_FULFILLED`
  ) {
    return {
      ...state,
      count: 0,
      isPending: false,
    };
  }

  if (
    action.type === (`${UPLOAD}_REJECTED` as const) ||
    action.type === (`${ERASE}_REJECTED` as const)
  ) {
    const { error } = action;

    log.error(
      `Failed to upload crash report due to error ${Errors.toLogFormat(error)}`
    );

    return {
      ...state,
      count: 0,
      isPending: false,
    };
  }

  return state;
}
