import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { isFinite, sortBy, uniq, xor } from 'lodash';

type RoomInfo = {
  canWrite: boolean;
  subscriberCount: number;
  moderators: Array<string>;
};

export type SogsRoomInfoState = {
  rooms: Record<string, RoomInfo>;
};

export const initialSogsRoomInfoState: SogsRoomInfoState = {
  rooms: {},
};

function addEmptyEntryIfNeeded(state: any, convoId: string) {
  if (!state.rooms[convoId]) {
    state.rooms[convoId] = { canWrite: true, subscriberCount: 0, moderators: [] };
  }
}

/**
 * This slice is the one holding the memory-only infos of sogs room. This includes
 * - writeCapability
 * - subscriberCount
 * - moderators
 *
 * Note: moderators are almost never used for sogs. We mostly rely on admins, which are tracked through the conversationModel.groupAdmins attributes (and saved to DB)
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
    setModerators(state, action: PayloadAction<{ convoId: string; moderators: Array<string> }>) {
      addEmptyEntryIfNeeded(state, action.payload.convoId);
      const existing = state.rooms[action.payload.convoId].moderators;
      const newMods = sortBy(uniq(action.payload.moderators));

      // check if there is any changes (order excluded) between those two arrays
      const xord = xor(existing, newMods);
      if (!xord.length) {
        return state;
      }

      state.rooms[action.payload.convoId].moderators = newMods;

      return state;
    },
  },
});

const { actions, reducer } = sogsRoomInfosSlice;
const { setSubscriberCount, setCanWrite, setModerators } = actions;

export const ReduxSogsRoomInfos = {
  setSubscriberCountOutsideRedux,
  setCanWriteOutsideRedux,
  setModeratorsOutsideRedux,
  sogsRoomInfoReducer: reducer,
};

function setSubscriberCountOutsideRedux(convoId: string, subscriberCount: number) {
  window.inboxStore?.dispatch(setSubscriberCount({ convoId, subscriberCount }));
}

function setCanWriteOutsideRedux(convoId: string, canWrite: boolean) {
  window.inboxStore?.dispatch(setCanWrite({ convoId, canWrite }));
}

/**
 * Update the redux slice for that community's moderators list
 * if we are a moderator that room and the room is blinded, this update needs to contain our unblinded pubkey, NOT the blinded one.
 *
 * @param convoId the convoId of the room to set the moderators
 * @param moderators the updated list of moderators
 */
function setModeratorsOutsideRedux(convoId: string, moderators: Array<string>) {
  window.inboxStore?.dispatch(
    setModerators({
      convoId,
      moderators,
    })
  );
  return undefined;
}
