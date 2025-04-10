// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createSelector } from 'reselect';
import type { StateType } from '../reducer';
import type { GifsStateType } from '../ducks/gifs';

export const selectGifs = (state: StateType): GifsStateType => state.gifs;

export const getRecentGifs = createSelector(selectGifs, gifs => {
  return gifs.recentGifs;
});
