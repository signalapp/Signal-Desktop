// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';
import { v4 as getGuid } from 'uuid';
import { ThunkAction } from 'redux-thunk';
import { StateType as RootStateType } from '../reducer';
import * as storageShim from '../../shims/storage';
import { useBoundActions } from '../../util/hooks';
import {
  ConversationColors,
  ConversationColorType,
  CustomColorType,
} from '../../types/Colors';
import { reloadSelectedConversation } from '../../shims/reloadSelectedConversation';

// State

export type ItemsStateType = {
  readonly universalExpireTimer?: number;

  readonly [key: string]: unknown;

  // This property should always be set and this is ensured in background.ts
  readonly defaultConversationColor?: {
    color: ConversationColorType;
    customColorData?: {
      id: string;
      value: CustomColorType;
    };
  };

  readonly customColors?: {
    readonly colors: Record<string, CustomColorType>;
    readonly version: number;
  };
};

// Actions

type ItemPutAction = {
  type: 'items/PUT';
  payload: null;
};

type ItemPutExternalAction = {
  type: 'items/PUT_EXTERNAL';
  payload: {
    key: string;
    value: unknown;
  };
};

type ItemRemoveAction = {
  type: 'items/REMOVE';
  payload: null;
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
  addCustomColor,
  editCustomColor,
  removeCustomColor,
  resetDefaultChatColor,
  setGlobalDefaultConversationColor,
  onSetSkinTone,
  putItem,
  putItemExternal,
  removeItem,
  removeItemExternal,
  resetItems,
};

export const useActions = (): typeof actions => useBoundActions(actions);

function putItem(key: string, value: unknown): ItemPutAction {
  storageShim.put(key, value);

  return {
    type: 'items/PUT',
    payload: null,
  };
}

function onSetSkinTone(tone: number): ItemPutAction {
  return putItem('skinTone', tone);
}

function putItemExternal(key: string, value: unknown): ItemPutExternalAction {
  return {
    type: 'items/PUT_EXTERNAL',
    payload: {
      key,
      value,
    },
  };
}

function removeItem(key: string): ItemRemoveAction {
  storageShim.remove(key);

  return {
    type: 'items/REMOVE',
    payload: null,
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

function getDefaultCustomColorData() {
  return {
    colors: {},
    version: 1,
  };
}

function addCustomColor(
  customColor: CustomColorType,
  nextAction: (uuid: string) => unknown
): ThunkAction<void, RootStateType, unknown, ItemPutAction> {
  return (dispatch, getState) => {
    const { customColors = getDefaultCustomColorData() } = getState().items;

    let uuid = getGuid();
    while (customColors.colors[uuid]) {
      uuid = getGuid();
    }

    const nextCustomColors = {
      ...customColors,
      colors: {
        ...customColors.colors,
        [uuid]: customColor,
      },
    };

    dispatch(putItem('customColors', nextCustomColors));
    nextAction(uuid);
  };
}

function editCustomColor(
  colorId: string,
  color: CustomColorType
): ThunkAction<void, RootStateType, unknown, ItemPutAction> {
  return (dispatch, getState) => {
    const { customColors = getDefaultCustomColorData() } = getState().items;

    if (!customColors.colors[colorId]) {
      return;
    }

    const nextCustomColors = {
      ...customColors,
      colors: {
        ...customColors.colors,
        [colorId]: color,
      },
    };

    dispatch(putItem('customColors', nextCustomColors));
  };
}

function removeCustomColor(
  payload: string
): ThunkAction<void, RootStateType, unknown, ItemPutAction> {
  return (dispatch, getState) => {
    const { customColors = getDefaultCustomColorData() } = getState().items;

    const nextCustomColors = {
      ...customColors,
      colors: omit(customColors.colors, payload),
    };

    dispatch(putItem('customColors', nextCustomColors));
  };
}

function resetDefaultChatColor(): ThunkAction<
  void,
  RootStateType,
  unknown,
  ItemPutAction
> {
  return dispatch => {
    dispatch(
      putItem('defaultConversationColor', {
        color: ConversationColors[0],
      })
    );
    reloadSelectedConversation();
  };
}

function setGlobalDefaultConversationColor(
  color: ConversationColorType,
  customColorData?: {
    id: string;
    value: CustomColorType;
  }
): ThunkAction<void, RootStateType, unknown, ItemPutAction> {
  return dispatch => {
    dispatch(
      putItem('defaultConversationColor', {
        color,
        customColorData,
      })
    );
    reloadSelectedConversation();
  };
}

// Reducer

function getEmptyState(): ItemsStateType {
  return {
    defaultConversationColor: {
      color: ConversationColors[0],
    },
  };
}

export function reducer(
  state: Readonly<ItemsStateType> = getEmptyState(),
  action: Readonly<ItemsActionType>
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
