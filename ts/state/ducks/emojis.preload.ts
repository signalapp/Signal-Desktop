// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import { DataWriter } from '../../sql/Client.preload.ts';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import type { FunEmojiSelection } from '../../components/fun/panels/FunPanelEmojis.dom.tsx';
import {
  getEmojiParentByKey,
  getEmojiParentKeyByVariantKey,
} from '../../components/fun/data/emojis.std.ts';

const { take, uniq } = lodash;

const { updateEmojiUsage } = DataWriter;

// State

export type EmojisStateType = ReadonlyDeep<{
  recents: Array<string>;
}>;

// Actions

type EmojiUsedAction = ReadonlyDeep<{
  type: 'emojis/EMOJI_USED';
  payload: string;
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
      const emojiParentKey = getEmojiParentKeyByVariantKey(
        emojiSelection.variantKey
      );
      const emojiParent = getEmojiParentByKey(emojiParentKey);
      const shortName = emojiParent.englishShortNameDefault;
      await updateEmojiUsage(shortName);
      dispatch(emojiUsed(shortName));
    } catch (err) {
      // Errors are ignored.
    }
  };
}

function emojiUsed(payload: string): EmojiUsedAction {
  return {
    type: 'emojis/EMOJI_USED',
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
  if (action.type === 'emojis/EMOJI_USED') {
    const { payload } = action;

    return {
      ...state,
      recents: take(uniq([payload, ...state.recents]), 32),
    };
  }

  return state;
}
