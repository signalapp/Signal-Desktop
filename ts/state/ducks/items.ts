// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';
import { v4 as getGuid } from 'uuid';
import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import type { StateType as RootStateType } from '../reducer';
import * as storageShim from '../../shims/storage';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import { drop } from '../../util/drop';
import type {
  ConversationColorType,
  CustomColorType,
} from '../../types/Colors';
import { ConversationColors } from '../../types/Colors';
import { reloadSelectedConversation } from '../../shims/reloadSelectedConversation';
import type { StorageAccessType } from '../../types/Storage.d';
import { actions as conversationActions } from './conversations';
import type { ConfigMapType as RemoteConfigType } from '../../RemoteConfig';

// State

export type ItemsStateType = ReadonlyDeep<
  {
    [key: string]: unknown;
    remoteConfig?: RemoteConfigType;
    serverTimeSkew?: number;
  } & Partial<StorageAccessType>
>;

// Actions

type ItemPutAction = ReadonlyDeep<{
  type: 'items/PUT';
  payload: null;
}>;

type ItemPutExternalAction = ReadonlyDeep<{
  type: 'items/PUT_EXTERNAL';
  payload: {
    key: string;
    value: unknown;
  };
}>;

type ItemRemoveAction = ReadonlyDeep<{
  type: 'items/REMOVE';
  payload: null;
}>;

type ItemRemoveExternalAction = ReadonlyDeep<{
  type: 'items/REMOVE_EXTERNAL';
  payload: string;
}>;

type ItemsResetAction = ReadonlyDeep<{
  type: 'items/RESET';
}>;

export type ItemsActionType = ReadonlyDeep<
  | ItemPutAction
  | ItemPutExternalAction
  | ItemRemoveAction
  | ItemRemoveExternalAction
  | ItemsResetAction
>;

// Action Creators

export const actions = {
  addCustomColor,
  editCustomColor,
  removeCustomColor,
  resetDefaultChatColor,
  savePreferredLeftPaneWidth,
  setGlobalDefaultConversationColor,
  toggleNavTabsCollapse,
  onSetSkinTone,
  putItem,
  putItemExternal,
  removeItem,
  removeItemExternal,
  resetItems,
};

export const useItemsActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function putItem<K extends keyof StorageAccessType>(
  key: K,
  value: StorageAccessType[K]
): ThunkAction<void, RootStateType, unknown, ItemPutAction> {
  return async dispatch => {
    dispatch({
      type: 'items/PUT',
      payload: null,
    });
    await storageShim.put(key, value);
  };
}

function onSetSkinTone(
  tone: number
): ThunkAction<void, RootStateType, unknown, ItemPutAction> {
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

function removeItem(key: keyof StorageAccessType): ItemRemoveAction {
  drop(storageShim.remove(key));

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
    colors: {} as Record<string, CustomColorType>,
    version: 1,
    order: [],
  };
}

function addCustomColor(
  customColor: CustomColorType,
  conversationId?: string
): ThunkAction<void, RootStateType, unknown, ItemPutAction> {
  return (dispatch, getState) => {
    const { customColors = getDefaultCustomColorData() } = getState().items;

    let uuid = getGuid();
    while (customColors.colors[uuid]) {
      uuid = getGuid();
    }

    const order = new Set(customColors.order ?? []);
    order.delete(uuid);
    order.add(uuid);

    const nextCustomColors = {
      ...customColors,
      colors: {
        ...customColors.colors,
        [uuid]: customColor,
      },
      order: [...order],
    };

    dispatch(putItem('customColors', nextCustomColors));

    const customColorData = {
      id: uuid,
      value: customColor,
    };

    if (conversationId) {
      conversationActions.colorSelected({
        conversationId,
        conversationColor: 'custom',
        customColorData,
      })(dispatch, getState, null);
    } else {
      setGlobalDefaultConversationColor('custom', customColorData)(
        dispatch,
        getState,
        null
      );
    }
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
      order: customColors.order?.filter(id => id !== payload),
    };

    dispatch(putItem('customColors', nextCustomColors));
    resetDefaultChatColor()(dispatch, getState, null);
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

function savePreferredLeftPaneWidth(
  preferredWidth: number
): ThunkAction<void, RootStateType, unknown, ItemPutAction> {
  return dispatch => {
    dispatch(putItem('preferredLeftPaneWidth', preferredWidth));
  };
}

function toggleNavTabsCollapse(
  navTabsCollapsed: boolean
): ThunkAction<void, RootStateType, unknown, ItemPutAction> {
  return dispatch => {
    dispatch(putItem('navTabsCollapsed', navTabsCollapsed));
  };
}

// Reducer

export function getEmptyState(): ItemsStateType {
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

    if (state[payload.key] === payload.value) {
      return state;
    }

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
