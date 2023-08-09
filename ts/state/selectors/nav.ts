// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { StateType } from '../reducer';
import type { NavStateType } from '../ducks/nav';

function getNav(state: StateType): NavStateType {
  return state.nav;
}

export const getSelectedNavTab = createSelector(getNav, nav => {
  return nav.selectedNavTab;
});
