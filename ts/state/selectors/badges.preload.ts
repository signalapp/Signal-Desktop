// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed in Orbital cleanup

import { createSelector } from 'reselect';
import type { BadgeType } from '../../badges/types.std.js';
import type { StateType } from '../reducer.preload.js';

export type PreferredBadgeSelectorType = (
  badges: ReadonlyArray<{ id: string }>
) => BadgeType | undefined;

const getBadgesState = (state: StateType) => state.badges;

export const getBadges = createSelector(getBadgesState, () => []);

export const getBadgesSelector = createSelector(getBadgesState, () => []);

export const getPreferredBadgeSelector = createSelector(
  getBadgesState,
  (): PreferredBadgeSelectorType => {
    return () => undefined;
  }
);
