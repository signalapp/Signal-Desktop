import { combineReducers } from 'redux';

import {
  CallingActionType,
  CallingStateType,
  reducer as calling,
} from './ducks/calling';
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
  reducer as safetyNumber,
  SafetyNumberActionType,
  SafetyNumberStateType,
} from './ducks/safetyNumber';
import {
  reducer as search,
  SearchActionType,
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
  calling: CallingStateType;
  conversations: ConversationsStateType;
  emojis: EmojisStateType;
  expiration: ExpirationStateType;
  items: ItemsStateType;
  network: NetworkStateType;
  safetyNumber: SafetyNumberStateType;
  search: SearchStateType;
  stickers: StickersStateType;
  updates: UpdatesStateType;
  user: UserStateType;
};

export type ActionsType =
  | CallingActionType
  | EmojisActionType
  | ExpirationActionType
  | ConversationActionType
  | ItemsActionType
  | NetworkActionType
  | SafetyNumberActionType
  | StickersActionType
  | SearchActionType
  | UpdatesActionType;

export const reducers = {
  calling,
  conversations,
  emojis,
  expiration,
  items,
  network,
  safetyNumber,
  search,
  stickers,
  updates,
  user,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const reducer = combineReducers<StateType, ActionsType>(reducers as any);
