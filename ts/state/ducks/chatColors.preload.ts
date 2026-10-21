// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import type { ChatStyle } from '../../types/ChatStyle.std.ts';
import { DataWriter } from '../../sql/Client.preload.ts';
import type {
  ColorSelectedActionType,
  CustomColorRemovedActionType,
} from './conversations.preload.ts';
import { actions as conversationActions } from './conversations.preload.ts';
import type { DefaultBubbleColorChangedAction } from './account.preload.ts';
import {
  actions as accountActions,
  defaultBubbleColorChanged,
} from './account.preload.ts';
import type { AsyncStateThunk } from '../types.std.ts';

// State

export type ChatColorsStateType = ReadonlyDeep<{
  customChatColors: ReadonlyArray<ChatStyle.CustomChatColor>;
}>;

// Actions

const CUSTOM_CHAT_COLOR_ADDED = 'chatColors/CUSTOM_CHAT_COLOR_ADDED';
const CUSTOM_CHAT_COLOR_EDITED = 'chatColors/CUSTOM_CHAT_COLOR_EDITED';
const CUSTOM_CHAT_COLOR_REMOVED = 'chatColors/CUSTOM_CHAT_COLOR_REMOVED';
const CUSTOM_CHAT_COLORS_RESET = 'chatColors/CUSTOM_CHAT_COLORS_RESET';

type CustomChatColorAddedAction = ReadonlyDeep<{
  type: typeof CUSTOM_CHAT_COLOR_ADDED;
  payload: ChatStyle.CustomChatColor;
}>;

type CustomChatColorEditedAction = ReadonlyDeep<{
  type: typeof CUSTOM_CHAT_COLOR_EDITED;
  payload: ChatStyle.CustomChatColor;
}>;

type CustomChatColorRemovedAction = ReadonlyDeep<{
  type: typeof CUSTOM_CHAT_COLOR_REMOVED;
  payload: ChatStyle.CustomChatColorId;
}>;

type CustomChatColorsResetAction = ReadonlyDeep<{
  type: typeof CUSTOM_CHAT_COLORS_RESET;
}>;

export type ChatColorsActionType = ReadonlyDeep<
  | CustomChatColorAddedAction
  | CustomChatColorEditedAction
  | CustomChatColorRemovedAction
  | CustomChatColorsResetAction
>;

// Action Creators

export const actions = {
  addCustomColor,
  editCustomColor,
  removeCustomColor,
  resetCustomChatColors,
};

export const useChatColorsActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function addCustomColor(
  color: ChatStyle.CustomChatColor['color'],
  conversationId: string | null
): AsyncStateThunk<
  | CustomChatColorAddedAction
  | ColorSelectedActionType
  | DefaultBubbleColorChangedAction
> {
  return async dispatch => {
    const customChatColor = await DataWriter.createCustomChatColor(color);

    dispatch({
      type: CUSTOM_CHAT_COLOR_ADDED,
      payload: customChatColor,
    });

    const bubbleColor: ChatStyle['bubbleColor'] = {
      customChatColorId: customChatColor.id,
    };

    if (conversationId != null) {
      await dispatch(
        conversationActions.colorSelected({
          conversationId,
          bubbleColor,
        })
      );
    } else {
      await dispatch(accountActions.setGlobalDefaultBubbleColor(bubbleColor));
    }
  };
}

function editCustomColor(
  customChatColor: ChatStyle.CustomChatColor
): AsyncStateThunk<CustomChatColorEditedAction> {
  return async dispatch => {
    await DataWriter.updateCustomChatColor(customChatColor);

    dispatch({
      type: CUSTOM_CHAT_COLOR_EDITED,
      payload: customChatColor,
    });
  };
}

function removeCustomColor(
  id: ChatStyle.CustomChatColorId
): AsyncStateThunk<
  | CustomChatColorRemovedAction
  | CustomColorRemovedActionType
  | DefaultBubbleColorChangedAction
> {
  return async (dispatch, getState) => {
    // Clear the color from the conversation models first, and flush any
    // pending writes from before that, so that nothing writes the deleted
    // color after it's been deleted.
    await dispatch(conversationActions.removeCustomColorOnConversations(id));
    await DataWriter.flushUpdateConversationBatcher();

    // The foreign keys reset conversations and the default bubble color in the
    // database, the rest only needs to update redux
    await DataWriter.deleteCustomChatColor(id);

    dispatch({
      type: CUSTOM_CHAT_COLOR_REMOVED,
      payload: id,
    });

    const { defaultBubbleColor } = getState().account;
    if (defaultBubbleColor?.customChatColorId === id) {
      dispatch(defaultBubbleColorChanged(null));
    }
  };
}

function resetCustomChatColors(): CustomChatColorsResetAction {
  return { type: CUSTOM_CHAT_COLORS_RESET };
}

// Reducer

export function getEmptyState(): ChatColorsStateType {
  return {
    customChatColors: [],
  };
}

export function reducer(
  state: ChatColorsStateType = getEmptyState(),
  action: ChatColorsActionType
): ChatColorsStateType {
  if (action.type === CUSTOM_CHAT_COLORS_RESET) {
    return getEmptyState();
  }

  if (action.type === CUSTOM_CHAT_COLOR_ADDED) {
    return {
      ...state,
      customChatColors: [...state.customChatColors, action.payload],
    };
  }

  if (action.type === CUSTOM_CHAT_COLOR_EDITED) {
    const { payload } = action;
    return {
      ...state,
      customChatColors: state.customChatColors.map(customChatColor => {
        return customChatColor.id === payload.id ? payload : customChatColor;
      }),
    };
  }

  if (action.type === CUSTOM_CHAT_COLOR_REMOVED) {
    const id = action.payload;
    return {
      ...state,
      customChatColors: state.customChatColors.filter(customChatColor => {
        return customChatColor.id !== id;
      }),
    };
  }

  return state;
}
