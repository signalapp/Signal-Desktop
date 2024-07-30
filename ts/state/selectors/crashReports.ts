// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createSelector } from 'reselect';
import type { StateType } from '../reducer';
import type { CrashReportsStateType } from '../ducks/crashReports';

const getCrashReports = (state: StateType): CrashReportsStateType =>
  state.crashReports;

export const getCrashReportsIsPending = createSelector(
  getCrashReports,
  ({ isPending }) => isPending
);

export const getCrashReportCount = createSelector(
  getCrashReports,
  ({ count }) => count
);
