import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OpenGroupV2InfoJoinable } from '../../opengroup/opengroupV2/ApiUtil';

export type DefaultRoomsState = Array<OpenGroupV2InfoJoinable>;

const initialState: DefaultRoomsState = [];

/**
 * Payload to dispatch to update the base64 data of a default room
 */
export type Base64Update = {
  base64Data: string;
  roomId: string;
};

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
    updateDefaultBase64RoomData(state, action: PayloadAction<Base64Update>) {
      const payload = action.payload;
      const newState = state.map(room => {
        if (room.id === payload.roomId) {
          return {
            ...room,
            base64Data: payload.base64Data,
          };
        }
        return room;
      });
      return newState;
    },
  },
});

const { actions, reducer } = defaultRoomsSlice;
export const { updateDefaultRooms, updateDefaultBase64RoomData } = actions;
export const defaultRoomReducer = reducer;
