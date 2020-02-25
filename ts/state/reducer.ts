import { combineReducers } from 'redux';

import { reducer as search, SearchStateType } from './ducks/search';
import {
  ConversationsStateType,
  reducer as conversations,
} from './ducks/conversations';
import { reducer as user, UserStateType } from './ducks/user';


import { reducer as messages } from './ducks/search';


export type StateType = {
  search: SearchStateType;
  messages: any;
  conversations: ConversationsStateType;
  user: UserStateType;
};

export const reducers = {
  search,
  messages,
  conversations,
  user,
};

// Making this work would require that our reducer signature supported AnyAction, not
//   our restricted actions
// @ts-ignore
export const reducer = combineReducers(reducers);
