// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import type { Account } from '../../types/Account.std.ts';
import type { ChatStyle } from '../../types/ChatStyle.std.ts';
import { DataWriter } from '../../sql/Client.preload.ts';
import type { AsyncStateThunk } from '../types.std.ts';

// State

export type AccountStateType = ReadonlyDeep<Account>;

// Actions

const DEFAULT_BUBBLE_COLOR_CHANGED = 'account/DEFAULT_BUBBLE_COLOR_CHANGED';
const ACCOUNT_RESET = 'account/ACCOUNT_RESET';

export type DefaultBubbleColorChangedAction = ReadonlyDeep<{
  type: typeof DEFAULT_BUBBLE_COLOR_CHANGED;
  payload: ChatStyle['bubbleColor'] | null;
}>;

type AccountResetAction = ReadonlyDeep<{
  type: typeof ACCOUNT_RESET;
}>;

export type AccountActionType = ReadonlyDeep<
  DefaultBubbleColorChangedAction | AccountResetAction
>;

// Action Creators

export const actions = {
  resetAccount,
  resetDefaultChatColor,
  setGlobalDefaultBubbleColor,
};

export const useAccountActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function defaultBubbleColorChanged(
  bubbleColor: ChatStyle['bubbleColor'] | null
): DefaultBubbleColorChangedAction {
  return {
    type: DEFAULT_BUBBLE_COLOR_CHANGED,
    payload: bubbleColor,
  };
}

function resetAccount(): AccountResetAction {
  return { type: ACCOUNT_RESET };
}

function resetDefaultChatColor(): AsyncStateThunk<DefaultBubbleColorChangedAction> {
  return setGlobalDefaultBubbleColor(null);
}

function setGlobalDefaultBubbleColor(
  bubbleColor: ChatStyle['bubbleColor'] | null
): AsyncStateThunk<DefaultBubbleColorChangedAction> {
  return async dispatch => {
    await DataWriter.updateAccountDefaultBubbleColor(bubbleColor);
    dispatch(defaultBubbleColorChanged(bubbleColor));
  };
}

// Reducer

export function getEmptyState(): AccountStateType {
  return {
    defaultBubbleColor: null,
  };
}

export function reducer(
  state: AccountStateType = getEmptyState(),
  action: AccountActionType
): AccountStateType {
  if (action.type === ACCOUNT_RESET) {
    return getEmptyState();
  }

  if (action.type === DEFAULT_BUBBLE_COLOR_CHANGED) {
    return {
      ...state,
      defaultBubbleColor: action.payload,
    };
  }

  return state;
}
