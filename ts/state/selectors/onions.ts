import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import { OnionState } from '../ducks/onion';
import { SectionType } from '../../state/ducks/section';

export const getOnionPaths = (state: StateType): OnionState => state.onionPaths;

export const getOnionPathsCount = createSelector(
  getOnionPaths,
  (state: OnionState): SectionType => state.snodePaths.length
);

export const getFirstOnionPath = createSelector(
  getOnionPaths,
  (state: OnionState): Array<{ ip: string }> => state.snodePaths?.[0] || []
);

export const getFirstOnionPathLength = createSelector(
  getFirstOnionPath,
  (state: Array<{ ip: string }>): number => state.length || 0
);

export const getIsOnline = createSelector(
  getOnionPaths,
  (state: OnionState): boolean => state.isOnline
);
