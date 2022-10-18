// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../../logging/log';
import { showToast } from '../../util/showToast';
import * as Errors from '../../types/errors';
import { ToastLinkCopied } from '../../components/ToastLinkCopied';
import { ToastDebugLogError } from '../../components/ToastDebugLogError';
import type { PromiseAction } from '../util';

// State

export type CrashReportsStateType = {
  count: number;
  isPending: boolean;
};

// Actions

const SET_COUNT = 'crashReports/SET_COUNT';
const UPLOAD = 'crashReports/UPLOAD';
const ERASE = 'crashReports/ERASE';

type SetCrashReportCountActionType = {
  type: typeof SET_COUNT;
  payload: number;
};

type CrashReportsActionType =
  | SetCrashReportCountActionType
  | PromiseAction<typeof UPLOAD>
  | PromiseAction<typeof ERASE>;

// Action Creators

export const actions = {
  setCrashReportCount,
  uploadCrashReports,
  eraseCrashReports,
};

function setCrashReportCount(count: number): SetCrashReportCountActionType {
  return { type: SET_COUNT, payload: count };
}

function uploadCrashReports(): PromiseAction<typeof UPLOAD> {
  return { type: UPLOAD, payload: window.crashReports.upload() };
}

function eraseCrashReports(): PromiseAction<typeof ERASE> {
  return { type: ERASE, payload: window.crashReports.erase() };
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
    if (action.type === `${UPLOAD}_FULFILLED`) {
      showToast(ToastLinkCopied);
    }
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

    showToast(ToastDebugLogError);

    return {
      ...state,
      count: 0,
      isPending: false,
    };
  }

  return state;
}
