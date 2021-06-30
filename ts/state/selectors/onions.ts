import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import { SectionType } from '../../components/session/ActionsPanel';
import { OnionState } from '../ducks/onion';
import { Snode } from '../../data/data';

export const getOnionPaths = (state: StateType): OnionState => state.onionPaths;

export const getOnionPathsCount = createSelector(
  getOnionPaths,
  (state: OnionState): SectionType => state.snodePaths.length
);

export const getFirstOnionPath = createSelector(
  getOnionPaths,
  (state: OnionState): Array<Snode> => state.snodePaths?.[0] || []
);

export const getFirstOnionPathLength = createSelector(
  getFirstOnionPath,
  (state: Array<Snode>): number => state.length || 0
);

export const getIsOnline = createSelector(
  getOnionPaths,
  (state: OnionState): boolean => state.isOnline
);
