import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import _, { forEach } from 'underscore';
import { SnodePath, Snode } from '../../session/onions/index';

export type OnionState = {
  // nodes: Array<OnionPathNodeType>;
  // path: SnodePath;
  snodePath: SnodePath;
};

// const initialState: OnionState = {
//   // nodes: new Array<OnionPathNodeType>(),
//   nodes: new Array<Snode>(),
// };

const initialState = {
  snodePath: {
    path: new Array<Snode>(),
    bad: false,
  },
};

/**
 * This slice is the one holding the default joinable rooms fetched once in a while from the default opengroup v2 server.
 */
const onionSlice = createSlice({
  name: 'onionPaths',
  initialState,
  reducers: {
    updateOnionPaths(state, action: PayloadAction<SnodePath>) {
      let newPayload = { snodePath: action.payload };

      let isEqual = JSON.stringify(state, null, 2) == JSON.stringify(newPayload, null, 2);
      return isEqual ? state : newPayload;

      return newPayload;
    },
  },
});

// destructures
const { actions, reducer } = onionSlice;
export const { updateOnionPaths } = actions;
export const defaultOnionReducer = reducer;
