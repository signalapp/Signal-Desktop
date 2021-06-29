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

// tslint:disable-next-line: no-submodule-imports match-default-export-name
import storage from 'redux-persist/lib/storage';
import persistReducer from 'redux-persist/lib/persistReducer';

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
};

const conversationsPersistConfig = {
  key: 'conversations',
  storage,
  whitelist: ['conversationLookup']
}

export const reducers = {
  search,
  conversations: persistReducer(conversationsPersistConfig, conversations),
  user,
  theme,
  section,
  defaultRooms,
  mentionsInput,
  onionPaths,
  modals,
  userConfig,
};

// Making this work would require that our reducer signature supported AnyAction, not
//   our restricted actions
// @ts-ignore
export const reducer = combineReducers(reducers);
