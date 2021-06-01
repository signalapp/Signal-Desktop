// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { ITEM_NAME as UNIVERSAL_EXPIRE_TIMER_ITEM } from '../../util/universalExpireTimer';

import { StateType } from '../reducer';
import { ItemsStateType } from '../ducks/items';

export const getItems = (state: StateType): ItemsStateType => state.items;

export const getUserAgent = createSelector(
  getItems,
  (state: ItemsStateType): string => state.userAgent as string
);

export const getPinnedConversationIds = createSelector(
  getItems,
  (state: ItemsStateType): Array<string> =>
    (state.pinnedConversationIds || []) as Array<string>
);

export const getUniversalExpireTimer = createSelector(
  getItems,
  (state: ItemsStateType): number => state[UNIVERSAL_EXPIRE_TIMER_ITEM] || 0
);
