import { createSelector } from 'reselect';
import type { StateType } from '../reducer';
import type { GifsStateType } from '../ducks/gifs';

export const getGifs = (state: StateType): GifsStateType => state.gifs;

export const getRecentGifs = createSelector(
  getGifs,
  ({ recentGifs }) => recentGifs
);
