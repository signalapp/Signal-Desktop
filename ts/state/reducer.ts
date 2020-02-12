import { combineReducers } from 'redux';

import {
  ConversationActionType,
  ConversationsStateType,
  reducer as conversations,
} from './ducks/conversations';
import {
  EmojisActionType,
  EmojisStateType,
  reducer as emojis,
} from './ducks/emojis';
import {
  ExpirationActionType,
  ExpirationStateType,
  reducer as expiration,
} from './ducks/expiration';
import {
  ItemsActionType,
  ItemsStateType,
  reducer as items,
} from './ducks/items';
import {
  NetworkActionType,
  NetworkStateType,
  reducer as network,
} from './ducks/network';
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
import {
  reducer as updates,
  UpdatesActionType,
  UpdatesStateType,
} from './ducks/updates';
import { reducer as user, UserStateType } from './ducks/user';

export type StateType = {
  conversations: ConversationsStateType;
  emojis: EmojisStateType;
  expiration: ExpirationStateType;
  items: ItemsStateType;
  network: NetworkStateType;
  search: SearchStateType;
  stickers: StickersStateType;
  updates: UpdatesStateType;
  user: UserStateType;
};

export type ActionsType =
  | EmojisActionType
  | ExpirationActionType
  | ConversationActionType
  | ItemsActionType
  | NetworkActionType
  | StickersActionType
  | SearchActionType
  | UpdatesActionType;

export const reducers = {
  conversations,
  emojis,
  expiration,
  items,
  network,
  search,
  stickers,
  updates,
  user,
};

// @ts-ignore: AnyAction breaks strong type checking inside reducers
export const reducer = combineReducers<StateType, ActionsType>(reducers);
