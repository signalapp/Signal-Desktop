// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import { DataWriter } from '../../sql/Client.preload.ts';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import type { FunEmojiSelection } from '../../components/fun/panels/FunPanelEmojis.dom.tsx';
import { Emoji } from '../../axo/emoji.std.ts';

const { updateEmojiUsage } = DataWriter;

// State

export type EmojisStateType = ReadonlyDeep<{
  recentEmojis: Array<Emoji.Parent>;
}>;

// Actions

type EmojiUsedAction = ReadonlyDeep<{
  type: 'emojis/EMOJI_USED';
  payload: Emoji.Parent;
}>;

type EmojisActionType = ReadonlyDeep<EmojiUsedAction>;

// Action Creators

export const actions = {
  onUseEmoji,
};

export const useEmojisActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function onUseEmoji(
  emojiSelection: FunEmojiSelection
): ThunkAction<void, unknown, unknown, EmojiUsedAction> {
  return async dispatch => {
    try {
      const parent = Emoji.getParent(emojiSelection.emoji);
      await updateEmojiUsage(parent, Date.now());
      dispatch(emojiUsed(parent));
    } catch (err) {
      // Errors are ignored.
    }
  };
}

function emojiUsed(payload: Emoji.Parent): EmojiUsedAction {
  return {
    type: 'emojis/EMOJI_USED',
    payload,
  };
}

// Reducer

export function getEmptyState(): EmojisStateType {
  return {
    recentEmojis: [],
  };
}

export function reducer(
  state: EmojisStateType = getEmptyState(),
  action: EmojisActionType
): EmojisStateType {
  if (action.type === 'emojis/EMOJI_USED') {
    const { payload } = action;

    return {
      ...state,
      recentEmojis: [
        payload,
        ...state.recentEmojis.filter(emoji => {
          return emoji !== payload;
        }),
      ].slice(0, 32),
    };
  }

  return state;
}
