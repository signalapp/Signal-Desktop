// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createSelector } from 'reselect';
import type { StateType } from '../reducer';
import type { ToastStateType } from '../ducks/toast';

export function getToastState(state: StateType): ToastStateType {
  return state.toast;
}

export const getToast = createSelector(getToastState, ({ toast }) => toast);
