// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer.preload.js';
import { isEmojiEnglishShortName } from '../../components/fun/data/emojis.std.js';

export const selectRecentEmojis = createSelector(
  ({ emojis }: StateType) => emojis.recents,
  recents => recents.filter(isEmojiEnglishShortName)
);

export const useRecentEmojis = (): Array<string> =>
  useSelector(selectRecentEmojis);
