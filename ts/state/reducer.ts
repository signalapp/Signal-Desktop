import { combineReducers } from 'redux';

import {
  ConversationActionType,
  ConversationsStateType,
  reducer as conversations,
} from './ducks/conversations';
import {
  ItemsActionType,
  ItemsStateType,
  reducer as items,
} from './ducks/items';
import {
  reducer as search,
  SEARCH_TYPES as SearchActionType,
  SearchStateType,
} from './ducks/search';
import {
  reducer as stickers,
  StickersActionType,
  StickersStateType,
} from './ducks/stickers';
import { reducer as user, UserStateType } from './ducks/user';

export type StateType = {
  conversations: ConversationsStateType;
  items: ItemsStateType;
  search: SearchStateType;
  stickers: StickersStateType;
  user: UserStateType;
};

export type ActionsType =
  | ItemsActionType
  | ConversationActionType
  | StickersActionType
  | SearchActionType;

export const reducers = {
  conversations,
  items,
  search,
  stickers,
  user,
};

// @ts-ignore: AnyAction breaks strong type checking inside reducers
export const reducer = combineReducers<StateType, ActionsType>(reducers);
