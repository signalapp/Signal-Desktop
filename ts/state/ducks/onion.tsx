import { createSlice, PayloadAction } from '@reduxjs/toolkit';
// import { OpenGroupV2InfoJoinable } from '../../opengroup/opengroupV2/ApiUtil';

// export type DefaultRoomsState = Array<OpenGroupV2InfoJoinable>;

export type OnionState = {
  nodes: Array<OnionPathNodeType>;
  // ip?: string;
  // label?: string;
  // isConnected?: boolean;
  // isAttemptingConnect?: boolean;
};

const initialState: OnionState = {
  nodes: new Array<OnionPathNodeType>(),
};

// const initialState: OnionState = {
//   ip: '',
//   label: '',
//   isConnected: false,
//   isAttemptingConnect: false
// };

/**
 * Payload to dispatch to update the base64 data of a default room
 */
export type Base64Update = {
  base64Data: string;
  roomId: string;
};

/**
 * Type for a singular onion node to be used in the onion redux state.
 */
export type OnionPathNodeType = {
  ip?: string;
  label?: string;
  isConnected?: boolean;
  isAttemptingConnect?: boolean;
};

/**
 * Payload to dispatch an update of the onion node paths
 */
export type OnionUpdate = {
  nodes: Array<OnionPathNodeType>;
};

/**
 * This slice is the one holding the default joinable rooms fetched once in a while from the default opengroup v2 server.
 */
const onionSlice = createSlice({
  name: 'onionPaths',
  initialState,
  reducers: {
    updateOnionPaths(state, action: PayloadAction<OnionUpdate>) {
      window.log.warn('updating default rooms', action.payload);
      return action.payload as OnionState;
    },
  },
});

// destructures
const { actions, reducer } = onionSlice;
export const { updateOnionPaths } = actions;
export const defaultOnionReducer = reducer;
