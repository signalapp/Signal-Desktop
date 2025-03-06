// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

// State

export enum ServerAlert {
  CRITICAL_IDLE_PRIMARY_DEVICE = 'critical_idle_primary_device',
}

export type ServerStateType = ReadonlyDeep<{
  alerts: Array<ServerAlert>;
}>;

// Actions

const UPDATE_SERVER_ALERTS = 'server/UPDATE_SERVER_ALERTS';

type UpdateServerAlertsType = ReadonlyDeep<{
  type: 'server/UPDATE_SERVER_ALERTS';
  payload: { alerts: Array<ServerAlert> };
}>;

export type ServerActionType = ReadonlyDeep<UpdateServerAlertsType>;

// Action Creators

function updateServerAlerts(alerts: Array<ServerAlert>): ServerActionType {
  return {
    type: UPDATE_SERVER_ALERTS,
    payload: { alerts },
  };
}

export const actions = {
  updateServerAlerts,
};

// Reducer

export function getEmptyState(): ServerStateType {
  return {
    alerts: [],
  };
}

export function reducer(
  state: Readonly<ServerStateType> = getEmptyState(),
  action: Readonly<ServerActionType>
): ServerStateType {
  if (action.type === UPDATE_SERVER_ALERTS) {
    return {
      alerts: action.payload.alerts,
    };
  }

  return state;
}
