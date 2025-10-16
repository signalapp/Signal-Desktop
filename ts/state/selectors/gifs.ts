// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createSelector } from 'reselect';
import type { StateType } from '../reducer.preload.js';
import type { GifsStateType } from '../ducks/gifs.preload.js';

export const selectGifs = (state: StateType): GifsStateType => state.gifs;

export const getRecentGifs = createSelector(selectGifs, gifs => {
  return gifs.recentGifs;
});
