import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type RoomInfo = {
  canWrite: boolean;
  subscriberCount: number;
};

export type SogsRoomInfoState = {
  rooms: Record<string, RoomInfo>;
};

export const initialSogsRoomInfoState: SogsRoomInfoState = {
  rooms: {},
};

function addEmptyEntryIfNeeded(state: any, convoId: string) {
  if (!state.rooms[convoId]) {
    state.rooms[convoId] = { canWrite: true, subscriberCount: 0 };
  }
}

/**
 * This slice is the one holding the memory-only infos of sogs room. This includes
 * - writeCapability
 * - subscriberCount
 */
const sogsRoomInfosSlice = createSlice({
  name: 'sogsRoomInfos',
  initialState: initialSogsRoomInfoState,
  reducers: {
    setSubscriberCount(state, action: PayloadAction<{ convoId: string; subscriberCount: number }>) {
      addEmptyEntryIfNeeded(state, action.payload.convoId);
      if (isFinite(action.payload.subscriberCount)) {
        state.rooms[action.payload.convoId].subscriberCount = action.payload.subscriberCount;
      }
      return state;
    },
    setCanWrite(state, action: PayloadAction<{ convoId: string; canWrite: boolean }>) {
      addEmptyEntryIfNeeded(state, action.payload.convoId);
      state.rooms[action.payload.convoId].canWrite = !!action.payload.canWrite;

      return state;
    },
  },
});

const { actions, reducer } = sogsRoomInfosSlice;
const { setSubscriberCount, setCanWrite } = actions;

export const ReduxSogsRoomInfos = {
  setSubscriberCountOutsideRedux,
  setCanWriteOutsideRedux,
  sogsRoomInfoReducer: reducer,
};

function setSubscriberCountOutsideRedux(convoId: string, subscriberCount: number) {
  window.inboxStore?.dispatch(setSubscriberCount({ convoId, subscriberCount }));
}

function setCanWriteOutsideRedux(convoId: string, canWrite: boolean) {
  window.inboxStore?.dispatch(setCanWrite({ convoId, canWrite }));
}
