// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import { createLogger } from '../../logging/log';
import { useBoundActions } from '../../hooks/useBoundActions';
import { NavTab, SettingsPage } from '../../types/Nav';

import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type { StateType as RootStateType } from '../reducer';
import type { Location } from '../../types/Nav';

const log = createLogger('nav');

// Types

function printLocation(location: Location): string {
  if (location.tab === NavTab.Settings) {
    if (location.details.page === SettingsPage.Profile) {
      return `${location.tab}/${location.details.page}/${location.details.state}`;
    }
    return `${location.tab}/${location.details.page}`;
  }

  return `${location.tab}`;
}

// State

export type NavStateType = ReadonlyDeep<{
  selectedLocation: Location;
}>;

// Actions

export const CHANGE_LOCATION = 'nav/CHANGE_LOCATION';

export type ChangeLocationAction = ReadonlyDeep<{
  type: typeof CHANGE_LOCATION;
  payload: { selectedLocation: Location };
}>;

export type NavActionType = ReadonlyDeep<ChangeLocationAction>;

// Action Creators

export function changeLocation(
  newLocation: Location
): ThunkAction<void, RootStateType, unknown, NavActionType> {
  return async (dispatch, getState) => {
    const existingLocation = getState().nav.selectedLocation;
    const logId = `changeLocation/${printLocation(newLocation)}`;

    const needToCancel =
      await window.Signal.Services.beforeNavigate.shouldCancelNavigation({
        context: logId,
        existingLocation,
        newLocation,
      });

    if (needToCancel) {
      log.info(`${logId}: Canceling navigation`);
      return;
    }

    dispatch({
      type: CHANGE_LOCATION,
      payload: { selectedLocation: newLocation },
    });
  };
}

export const actions = {
  changeLocation,
};

export const useNavActions = (): BoundActionCreatorsMapObject<typeof actions> =>
  useBoundActions(actions);

// Reducer

export function getEmptyState(): NavStateType {
  return {
    selectedLocation: {
      tab: NavTab.Chats,
    },
  };
}

export function reducer(
  state: Readonly<NavStateType> = getEmptyState(),
  action: Readonly<NavActionType>
): NavStateType {
  if (action.type === CHANGE_LOCATION) {
    return {
      ...state,
      selectedLocation: action.payload.selectedLocation,
    };
  }

  return state;
}
