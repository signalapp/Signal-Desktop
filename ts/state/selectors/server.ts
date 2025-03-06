// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer';
import { ServerAlert } from '../ducks/server';

export const getServerAlerts = (state: StateType): ReadonlyArray<ServerAlert> =>
  state.server.alerts;

export const getHasCriticalIdlePrimaryDeviceAlert = createSelector(
  getServerAlerts,
  (alerts): boolean => {
    return alerts.includes(ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE);
  }
);
