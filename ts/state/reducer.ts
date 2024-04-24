import { combineReducers } from '@reduxjs/toolkit';

import { callReducer as call, CallStateType } from './ducks/call'; // ok: importing only RingingManager.ts which is not importing anything else
import { reducer as conversations, ConversationsStateType } from './ducks/conversations'; // todo
import { defaultRoomReducer as defaultRooms, DefaultRoomsState } from './ducks/defaultRooms'; // todo
import { reducer as primaryColor } from './ducks/primaryColor'; // ok: importing only Constants.tsx which is not importing anything else
import { reducer as search, SearchStateType } from './ducks/search'; // todo
import { reducer as section, SectionStateType } from './ducks/section'; // ok: importing only SessionSettingsCategory which is not importing anything else
import { ReduxSogsRoomInfos, SogsRoomInfoState } from './ducks/sogsRoomInfo'; // ok: importing nothing else
import { reducer as theme } from './ducks/theme'; // ok: importing only Constants.tsx which is not importing anything else
import { reducer as user, UserStateType } from './ducks/user'; // ok: not importing anything else

import { PrimaryColorStateType, ThemeStateType } from '../themes/constants/colors'; // ok: not importing anything else
import { modalReducer as modals, ModalState } from './ducks/modalDialog'; // todo
import { defaultOnionReducer as onionPaths, OnionState } from './ducks/onion'; // ok: not importing anything else
import { settingsReducer, SettingsState } from './ducks/settings'; // ok: just importing settings-key.tsx which is not importing anything else
import {
  reducer as stagedAttachments,
  StagedAttachmentsStateType,
} from './ducks/stagedAttachments';
import { userConfigReducer as userConfig, UserConfigState } from './ducks/userConfig'; // ok: not importing anything else

export type StateType = {
  search: SearchStateType;
  user: UserStateType;
  conversations: ConversationsStateType;
  theme: ThemeStateType;
  primaryColor: PrimaryColorStateType;
  section: SectionStateType;
  defaultRooms: DefaultRoomsState;
  onionPaths: OnionState;
  modals: ModalState;
  userConfig: UserConfigState;
  stagedAttachments: StagedAttachmentsStateType;
  call: CallStateType;
  sogsRoomInfo: SogsRoomInfoState;
  settings: SettingsState;
};

const reducers = {
  search,
  conversations,
  user,
  theme,
  primaryColor,
  section,
  defaultRooms,
  onionPaths,
  modals,
  userConfig,
  stagedAttachments,
  call,
  sogsRoomInfo: ReduxSogsRoomInfos.sogsRoomInfoReducer,
  settings: settingsReducer,
};

// Making this work would require that our reducer signature supported AnyAction, not
//   our restricted actions
export const rootReducer = combineReducers(reducers);
