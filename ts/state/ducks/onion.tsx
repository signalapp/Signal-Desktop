import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SnodePath, Snode } from "../../session/onions/index";

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
    bad: false
  }
}

/**
 * This slice is the one holding the default joinable rooms fetched once in a while from the default opengroup v2 server.
 */
const onionSlice = createSlice({
  name: 'onionPaths',
  initialState,
  reducers: {
    // updateOnionPaths(state, action: PayloadAction<OnionUpdate>) {
    updateOnionPaths(state, action: PayloadAction<SnodePath>) {
      console.log('@@@@ dispatching:: ', action);
      return {
        snodePath: action.payload
      }
    },
  },
});

// destructures
const { actions, reducer } = onionSlice;
export const { updateOnionPaths } = actions;
export const defaultOnionReducer = reducer;
