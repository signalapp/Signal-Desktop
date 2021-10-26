// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import { useSelector } from 'react-redux';

import type { StateType } from '../reducer';
import { isShortName } from '../../components/emoji/lib';

export const selectRecentEmojis = createSelector(
  ({ emojis }: StateType) => emojis.recents,
  recents => recents.filter(isShortName)
);

export const useRecentEmojis = (): Array<string> =>
  useSelector(selectRecentEmojis);
