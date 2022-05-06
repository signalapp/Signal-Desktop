// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';
import { v4 as getGuid } from 'uuid';
import type { ThunkAction } from 'redux-thunk';
import type { StateType as RootStateType } from '../reducer';
import * as storageShim from '../../shims/storage';
import { useBoundActions } from '../../hooks/useBoundActions';
import type {
  ConversationColorType,
  CustomColorType,
  CustomColorsItemType,
  DefaultConversationColorType,
} from '../../types/Colors';
import { ConversationColors } from '../../types/Colors';
import { reloadSelectedConversation } from '../../shims/reloadSelectedConversation';
import type { StorageAccessType } from '../../types/Storage.d';
import { actions as conversationActions } from './conversations';
import type { ConfigMapType as RemoteConfigType } from '../../RemoteConfig';

// State

export type ItemsStateType = {
  readonly universalExpireTimer?: number;

  readonly [key: string]: unknown;

  readonly remoteConfig?: RemoteConfigType;

  // This property should always be set and this is ensured in background.ts
  readonly defaultConversationColor?: DefaultConversationColorType;

  readonly customColors?: CustomColorsItemType;

  readonly preferredLeftPaneWidth?: number;

  readonly preferredReactionEmoji?: Array<string>;

  readonly areWeASubscriber?: boolean;
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
  savePreferredLeftPaneWidth,
  setGlobalDefaultConversationColor,
  onSetSkinTone,
  putItem,
  putItemExternal,
  removeItem,
  removeItemExternal,
  resetItems,
  toggleHasAllStoriesMuted,
};

export const useActions = (): typeof actions => useBoundActions(actions);

function putItem<K extends keyof StorageAccessType>(
  key: K,
  value: StorageAccessType[K]
): ItemPutAction {
  storageShim.put(key, value);

  return {
    type: 'items/PUT',
    payload: null,
  };
}

function onSetSkinTone(tone: number): ItemPutAction {
  return putItem('skinTone', tone);
}

function toggleHasAllStoriesMuted(): ThunkAction<
  void,
  RootStateType,
  unknown,
  ItemPutAction
> {
  return (dispatch, getState) => {
    const hasAllStoriesMuted = Boolean(getState().items.hasAllStoriesMuted);

    dispatch(putItem('hasAllStoriesMuted', !hasAllStoriesMuted));
  };
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
  conversationId?: string
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
