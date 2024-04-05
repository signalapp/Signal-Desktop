import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OpenGroupV2InfoJoinable } from '../../session/apis/open_group_api/opengroupV2/ApiUtil';

export type DefaultRoomsState = {
  rooms: Array<OpenGroupV2InfoJoinable>;
  inProgress: boolean;
};

export const initialDefaultRoomState: DefaultRoomsState = {
  rooms: [],
  inProgress: false,
};

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
  initialState: initialDefaultRoomState,
  reducers: {
    updateDefaultRooms(state, action) {
      // window?.log?.info('updating default rooms', action.payload);
      const rooms = action.payload as Array<OpenGroupV2InfoJoinable>;
      return { ...state, rooms };
    },
    updateDefaultRoomsInProgress(state, action) {
      const inProgress = action.payload as boolean;
      return { ...state, inProgress };
    },
    updateDefaultBase64RoomData(state, action: PayloadAction<Base64Update>) {
      const payload = action.payload;
      const newRoomsState = state.rooms.map(room => {
        if (room.id === payload.roomId) {
          return {
            ...room,
            base64Data: payload.base64Data,
          };
        }
        return room;
      });
      return { ...state, rooms: newRoomsState };
    },
  },
});

const { actions, reducer } = defaultRoomsSlice;
export const { updateDefaultRooms, updateDefaultBase64RoomData, updateDefaultRoomsInProgress } =
  actions;
export const defaultRoomReducer = reducer;
