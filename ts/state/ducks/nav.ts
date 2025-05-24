// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

// Types

export enum NavTab {
  Chats = 'Chats',
  Calls = 'Calls',
  Stories = 'Stories',
  Settings = 'Settings',
}

// State

export type NavStateType = ReadonlyDeep<{
  selectedNavTab: NavTab;
}>;

// Actions

export const CHANGE_NAV_TAB = 'nav/CHANGE_NAV_TAB';

export type ChangeNavTabActionType = ReadonlyDeep<{
  type: typeof CHANGE_NAV_TAB;
  payload: { selectedNavTab: NavTab };
}>;

export type NavActionType = ReadonlyDeep<ChangeNavTabActionType>;

// Action Creators

function changeNavTab(selectedNavTab: NavTab): NavActionType {
  return {
    type: CHANGE_NAV_TAB,
    payload: { selectedNavTab },
  };
}

export const actions = {
  changeNavTab,
};

export const useNavActions = (): BoundActionCreatorsMapObject<typeof actions> =>
  useBoundActions(actions);

// Reducer

export function getEmptyState(): NavStateType {
  return {
    selectedNavTab: NavTab.Chats,
  };
}

export function reducer(
  state: Readonly<NavStateType> = getEmptyState(),
  action: Readonly<NavActionType>
): NavStateType {
  if (action.type === CHANGE_NAV_TAB) {
    return {
      ...state,
      selectedNavTab: action.payload.selectedNavTab,
    };
  }

  return state;
}
