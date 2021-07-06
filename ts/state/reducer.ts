import { combineReducers } from 'redux';

import { reducer as search, SearchStateType } from './ducks/search';
import { ConversationsStateType, reducer as conversations } from './ducks/conversations';
import { reducer as user, UserStateType } from './ducks/user';
import { reducer as theme, ThemeStateType } from './ducks/theme';
import { reducer as section, SectionStateType } from './ducks/section';
import { defaultRoomReducer as defaultRooms, DefaultRoomsState } from './ducks/defaultRooms';
import {
  defaultMentionsInputReducer as mentionsInput,
  MentionsInputState,
} from './ducks/mentionsInput';
import { defaultOnionReducer as onionPaths, OnionState } from './ducks/onion';
import { modalReducer as modals, ModalState } from './ducks/modalDialog';
import { userConfigReducer as userConfig, UserConfigState } from './ducks/userConfig';
import { timerOptionReducer as timerOptions, TimerOptionsState } from './ducks/timerOptions';

export type StateType = {
  search: SearchStateType;
  user: UserStateType;
  conversations: ConversationsStateType;
  theme: ThemeStateType;
  section: SectionStateType;
  defaultRooms: DefaultRoomsState;
  mentionsInput: MentionsInputState;
  onionPaths: OnionState;
  modals: ModalState;
  userConfig: UserConfigState;
  timerOptions: TimerOptionsState;
};

export const reducers = {
  search,
  conversations,
  user,
  theme,
  section,
  defaultRooms,
  mentionsInput,
  onionPaths,
  modals,
  userConfig,
  timerOptions,
};

// Making this work would require that our reducer signature supported AnyAction, not
//   our restricted actions
// @ts-ignore
export const reducer = combineReducers(reducers);
