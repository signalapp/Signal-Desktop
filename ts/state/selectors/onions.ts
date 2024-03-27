import { createSelector } from '@reduxjs/toolkit';

import { useSelector } from 'react-redux';
import { OnionState } from '../ducks/onion';
import { SectionType } from '../ducks/section';
import { StateType } from '../reducer';

const getOnionPaths = (state: StateType): OnionState => state.onionPaths;

const getOnionPathsCount = createSelector(
  getOnionPaths,
  (state: OnionState): SectionType => state.snodePaths.length
);

const getFirstOnionPath = createSelector(
  getOnionPaths,
  (state: OnionState): Array<{ ip: string }> => state.snodePaths?.[0] || []
);

const getFirstOnionPathLength = createSelector(
  getFirstOnionPath,
  (state: Array<{ ip: string }>): number => state.length || 0
);

const getIsOnline = createSelector(getOnionPaths, (state: OnionState): boolean => state.isOnline);

export const useOnionPathsCount = () => {
  return useSelector(getOnionPathsCount);
};

export const useIsOnline = () => {
  return useSelector(getIsOnline);
};

export const useFirstOnionPathLength = () => {
  return useSelector(getFirstOnionPathLength);
};

export const useFirstOnionPath = () => {
  return useSelector(getFirstOnionPath);
};
