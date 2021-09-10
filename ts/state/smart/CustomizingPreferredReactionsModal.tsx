// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { useSelector } from 'react-redux';

import type { StateType } from '../reducer';
import type { LocalizerType } from '../../types/Util';
import { useActions as usePreferredReactionsActions } from '../ducks/preferredReactions';
import { useActions as useItemsActions } from '../ducks/items';
import { getIntl } from '../selectors/user';
import { getEmojiSkinTone } from '../selectors/items';
import { useRecentEmojis } from '../selectors/emojis';
import { getCustomizeModalState } from '../selectors/preferredReactions';

import { CustomizingPreferredReactionsModal } from '../../components/CustomizingPreferredReactionsModal';

export function SmartCustomizingPreferredReactionsModal(): JSX.Element {
  const preferredReactionsActions = usePreferredReactionsActions();
  const { onSetSkinTone } = useItemsActions();

  const i18n = useSelector<StateType, LocalizerType>(getIntl);

  const customizeModalState = useSelector<
    StateType,
    ReturnType<typeof getCustomizeModalState>
  >(state => getCustomizeModalState(state));

  const recentEmojis = useRecentEmojis();

  const skinTone = useSelector<StateType, number>(state =>
    getEmojiSkinTone(state)
  );

  if (!customizeModalState) {
    throw new Error(
      '<SmartCustomizingPreferredReactionsModal> requires a modal'
    );
  }

  return (
    <CustomizingPreferredReactionsModal
      i18n={i18n}
      onSetSkinTone={onSetSkinTone}
      recentEmojis={recentEmojis}
      skinTone={skinTone}
      {...preferredReactionsActions}
      {...customizeModalState}
    />
  );
}
