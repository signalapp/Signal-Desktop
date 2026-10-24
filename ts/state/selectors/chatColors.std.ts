// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createSelector } from 'reselect';
import type { StateType } from '../reducer.preload.ts';
import type { ChatColorsStateType } from '../ducks/chatColors.preload.ts';
import type {
  BubbleColorRenderData,
  ChatStyle,
} from '../../types/ChatStyle.std.ts';
import { resolveBubbleColorRenderData } from '../../util/getCustomColorStyle.std.ts';
import { getDefaultBubbleColor } from './account.std.ts';

export type BubbleColorResolver = (
  bubbleColor: ChatStyle['bubbleColor'] | null | undefined
) => BubbleColorRenderData;

function getChatColorsState(state: StateType): ChatColorsStateType {
  return state.chatColors;
}

export const getCustomChatColors = createSelector(
  getChatColorsState,
  (state): ReadonlyArray<ChatStyle.CustomChatColor> => {
    return state.customChatColors;
  }
);

export const getBubbleColorResolver = createSelector(
  getCustomChatColors,
  getDefaultBubbleColor,
  (customChatColors, defaultBubbleColor): BubbleColorResolver => {
    return bubbleColor => {
      return resolveBubbleColorRenderData(
        bubbleColor,
        defaultBubbleColor,
        customChatColors
      );
    };
  }
);
