// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createSelector } from 'reselect';
import type { StateType } from '../reducer';
import type { AppStateType } from '../ducks/app';

export const getApp = (state: StateType): AppStateType => state.app;

export const getHasInitialLoadCompleted = createSelector(
  getApp,
  ({ hasInitialLoadCompleted }) => hasInitialLoadCompleted
);

export const getAppView = createSelector(getApp, ({ appView }) => appView);
