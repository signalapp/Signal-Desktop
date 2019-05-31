import { omit } from 'lodash';
import * as storageShim from '../../shims/storage';

// State

export type ItemsStateType = {
  readonly [key: string]: any;
};

// Actions

type ItemPutAction = {
  type: 'items/PUT';
  payload: Promise<void>;
};

type ItemPutExternalAction = {
  type: 'items/PUT_EXTERNAL';
  payload: {
    key: string;
    value: any;
  };
};

type ItemRemoveAction = {
  type: 'items/REMOVE';
  payload: Promise<void>;
};

type ItemRemoveExternalAction = {
  type: 'items/REMOVE_EXTERNAL';
  payload: string;
};

type ItemsResetAction = {
  type: 'items/RESET';
};

export type ItemsActionType =
  | ItemPutAction
  | ItemPutExternalAction
  | ItemRemoveAction
  | ItemRemoveExternalAction
  | ItemsResetAction;

// Action Creators

export const actions = {
  putItem,
  putItemExternal,
  removeItem,
  removeItemExternal,
  resetItems,
};

function putItem(key: string, value: any): ItemPutAction {
  return {
    type: 'items/PUT',
    payload: storageShim.put(key, value),
  };
}

function putItemExternal(key: string, value: any): ItemPutExternalAction {
  return {
    type: 'items/PUT_EXTERNAL',
    payload: {
      key,
      value,
    },
  };
}

function removeItem(key: string): ItemRemoveAction {
  return {
    type: 'items/REMOVE',
    payload: storageShim.remove(key),
  };
}

function removeItemExternal(key: string): ItemRemoveExternalAction {
  return {
    type: 'items/REMOVE_EXTERNAL',
    payload: key,
  };
}

function resetItems(): ItemsResetAction {
  return { type: 'items/RESET' };
}

// Reducer

function getEmptyState(): ItemsStateType {
  return {};
}

export function reducer(
  state: ItemsStateType = getEmptyState(),
  action: ItemsActionType
): ItemsStateType {
  if (action.type === 'items/PUT_EXTERNAL') {
    const { payload } = action;

    return {
      ...state,
      [payload.key]: payload.value,
    };
  }

  if (action.type === 'items/REMOVE_EXTERNAL') {
    const { payload } = action;

    return omit(state, payload);
  }

  if (action.type === 'items/RESET') {
    return getEmptyState();
  }

  return state;
}
