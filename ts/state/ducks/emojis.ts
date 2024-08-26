// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { take, uniq } from 'lodash';
import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import type { EmojiPickDataType } from '../../components/emoji/EmojiPicker';
import { DataWriter } from '../../sql/Client';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

const { updateEmojiUsage } = DataWriter;

// State

export type EmojisStateType = ReadonlyDeep<{
  recents: Array<string>;
}>;

// Actions

type UseEmojiAction = ReadonlyDeep<{
  type: 'emojis/USE_EMOJI';
  payload: string;
}>;

type EmojisActionType = ReadonlyDeep<UseEmojiAction>;

// Action Creators

export const actions = {
  onUseEmoji,
  useEmoji,
};

export const useEmojisActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function onUseEmoji({
  shortName,
}: EmojiPickDataType): ThunkAction<void, unknown, unknown, UseEmojiAction> {
  return async dispatch => {
    try {
      await updateEmojiUsage(shortName);
      dispatch(useEmoji(shortName));
    } catch (err) {
      // Errors are ignored.
    }
  };
}

function useEmoji(payload: string): UseEmojiAction {
  return {
    type: 'emojis/USE_EMOJI',
    payload,
  };
}

// Reducer

export function getEmptyState(): EmojisStateType {
  return {
    recents: [],
  };
}

export function reducer(
  state: EmojisStateType = getEmptyState(),
  action: EmojisActionType
): EmojisStateType {
  if (action.type === 'emojis/USE_EMOJI') {
    const { payload } = action;

    return {
      ...state,
      recents: take(uniq([payload, ...state.recents]), 32),
    };
  }

  return state;
}
