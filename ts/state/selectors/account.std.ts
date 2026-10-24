// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createSelector } from 'reselect';
import type { StateType } from '../reducer.preload.ts';
import type { AccountStateType } from '../ducks/account.preload.ts';
import type { ChatStyle } from '../../types/ChatStyle.std.ts';
import { DEFAULT_BUBBLE_COLOR } from '../../types/ChatStyle.std.ts';

function getAccount(state: StateType): AccountStateType {
  return state.account;
}

export const getDefaultBubbleColor = createSelector(
  getAccount,
  (account): ChatStyle['bubbleColor'] => {
    return account.defaultBubbleColor ?? DEFAULT_BUBBLE_COLOR;
  }
);
