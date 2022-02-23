// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// State

export type ExpirationStateType = {
  hasExpired: boolean;
};

// Actions

const HYDRATE_EXPIRATION_STATUS = 'expiration/HYDRATE_EXPIRATION_STATUS';

type HyrdateExpirationStatusActionType = {
  type: 'expiration/HYDRATE_EXPIRATION_STATUS';
  payload: boolean;
};

export type ExpirationActionType = HyrdateExpirationStatusActionType;

// Action Creators

function hydrateExpirationStatus(hasExpired: boolean): ExpirationActionType {
  return {
    type: HYDRATE_EXPIRATION_STATUS,
    payload: hasExpired,
  };
}

export const actions = {
  hydrateExpirationStatus,
};

// Reducer

export function getEmptyState(): ExpirationStateType {
  return {
    hasExpired: false,
  };
}

export function reducer(
  state: Readonly<ExpirationStateType> = getEmptyState(),
  action: Readonly<ExpirationActionType>
): ExpirationStateType {
  if (action.type === HYDRATE_EXPIRATION_STATUS) {
    return {
      hasExpired: action.payload,
    };
  }

  return state;
}
