import type { GifsStateType } from '../state/ducks/gifs';
import { getEmptyState } from '../state/ducks/gifs';
import { strictAssert } from './assert';
import Data from '../sql/Client';

let initialState: GifsStateType | undefined;

const getRecentGifsForRedux = async () => {
  return Data.getRecentGifs();
};

export const loadGifs = async (): Promise<void> => {
  const recentGifs = await getRecentGifsForRedux();
  initialState = {
    ...getEmptyState(),
    recentGifs,
  };
};

export const getInitialGifsState = (): GifsStateType => {
  strictAssert(initialState !== undefined, 'Gifs not initialized');
  return initialState;
};
