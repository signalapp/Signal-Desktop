import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Snode } from '../../data/data';

export type OnionState = {
  snodePaths: Array<Array<Snode>>;
  isOnline: boolean;
};

export const initialOnionPathState = {
  snodePaths: new Array<Array<Snode>>(),
  isOnline: false,
};

/**
 * This slice is the one holding the default joinable rooms fetched once in a while from the default opengroup v2 server.
 */
const onionSlice = createSlice({
  name: 'onionPaths',
  initialState: initialOnionPathState,
  reducers: {
    updateOnionPaths(state: OnionState, action: PayloadAction<Array<Array<Snode>>>) {
      return { ...state, snodePaths: action.payload };
    },
    updateIsOnline(state: OnionState, action: PayloadAction<boolean>) {
      return { ...state, isOnline: action.payload };
    },
  },
});

// destructures
const { actions, reducer } = onionSlice;
export const { updateOnionPaths, updateIsOnline } = actions;
export const defaultOnionReducer = reducer;
