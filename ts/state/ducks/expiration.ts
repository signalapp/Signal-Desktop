// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

// State

export type ExpirationStateType = ReadonlyDeep<{
  buildExpiration: number;
}>;

// Actions

const HYDRATE_EXPIRATION_STATUS = 'expiration/HYDRATE_EXPIRATION_STATUS';

type HyrdateExpirationStatusActionType = ReadonlyDeep<{
  type: 'expiration/HYDRATE_EXPIRATION_STATUS';
  payload: { buildExpiration: number };
}>;

export type ExpirationActionType =
  ReadonlyDeep<HyrdateExpirationStatusActionType>;

// Action Creators

function hydrateExpirationStatus(
  buildExpiration: number
): ExpirationActionType {
  return {
    type: HYDRATE_EXPIRATION_STATUS,
    payload: { buildExpiration },
  };
}

export const actions = {
  hydrateExpirationStatus,
};

// Reducer

export function getEmptyState(): ExpirationStateType {
  return {
    buildExpiration: 0,
  };
}

export function reducer(
  state: Readonly<ExpirationStateType> = getEmptyState(),
  action: Readonly<ExpirationActionType>
): ExpirationStateType {
  if (action.type === HYDRATE_EXPIRATION_STATUS) {
    return {
      buildExpiration: action.payload.buildExpiration,
    };
  }

  return state;
}
