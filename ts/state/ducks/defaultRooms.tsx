import { createSlice } from '@reduxjs/toolkit';
import { OpenGroupV2InfoJoinable } from '../../opengroup/opengroupV2/ApiUtil';

export type DefaultRoomsState = Array<OpenGroupV2InfoJoinable>;

const initialState: DefaultRoomsState = [];

/**
 * This slice is the one holding the default joinable rooms fetched once in a while from the default opengroup v2 server.
 */
const defaultRoomsSlice = createSlice({
  name: 'defaultRooms',
  initialState,
  reducers: {
    updateDefaultRooms(state, action) {
      window.log.warn('updating default rooms', action.payload);
      return action.payload as DefaultRoomsState;
    },
  },
});

const { actions, reducer } = defaultRoomsSlice;
export const { updateDefaultRooms } = actions;
export const defaultRoomReducer = reducer;
