import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Snode } from '../../data/data';

export type OnionState = {
  snodePath: Array<Snode>;
};

const initialState = {
  snodePath: new Array<Snode>(),
};

/**
 * This slice is the one holding the default joinable rooms fetched once in a while from the default opengroup v2 server.
 */
const onionSlice = createSlice({
  name: 'onionPaths',
  initialState,
  reducers: {
    updateOnionPaths(state: OnionState, action: PayloadAction<Array<Snode>>) {
      return { snodePath: action.payload };
    },
  },
});

// destructures
const { actions, reducer } = onionSlice;
export const { updateOnionPaths } = actions;
export const defaultOnionReducer = reducer;
