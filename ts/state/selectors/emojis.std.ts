// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { StateType } from '../reducer.preload.ts';
import type { EmojisStateType } from '../ducks/emojis.preload.ts';
import type { StateSelector } from '../types.std.ts';
import type { Emoji } from '../../axo/emoji.std.ts';

function selectEmojisState(state: StateType): EmojisStateType {
  return state.emojis;
}

export const selectRecentEmojis: StateSelector<ReadonlyArray<Emoji.Parent>> =
  createSelector(selectEmojisState, state => {
    return state.recentEmojis;
  });
