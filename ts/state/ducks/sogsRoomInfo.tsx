import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { sortBy, uniq } from 'lodash';
import {
  getCanWriteOutsideRedux,
  getCurrentSubscriberCountOutsideRedux,
  getModeratorsOutsideRedux,
} from '../selectors/sogsRoomInfo';

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

      state.rooms[action.payload.convoId].moderators = sortBy(uniq(action.payload.moderators));

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
  if (subscriberCount === getCurrentSubscriberCountOutsideRedux(convoId)) {
    return;
  }
  window.inboxStore?.dispatch(setSubscriberCount({ convoId, subscriberCount }));
}

function setCanWriteOutsideRedux(convoId: string, canWrite: boolean) {
  if (getCanWriteOutsideRedux(convoId) === canWrite) {
    return;
  }
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
  const currentMods = getModeratorsOutsideRedux(convoId);
  if (sortBy(uniq(currentMods)) === sortBy(uniq(moderators))) {
    return;
  }
  window.inboxStore?.dispatch(
    setModerators({
      convoId,
      moderators,
    })
  );
  return undefined;
}
