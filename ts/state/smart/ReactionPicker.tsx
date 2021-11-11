// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';
import { useActions as usePreferredReactionsActions } from '../ducks/preferredReactions';
import { useActions as useItemsActions } from '../ducks/items';

import { getIntl } from '../selectors/user';
import { getPreferredReactionEmoji } from '../selectors/items';

import type { LocalizerType } from '../../types/Util';
import type { Props } from '../../components/conversation/ReactionPicker';
import { ReactionPicker } from '../../components/conversation/ReactionPicker';

type ExternalProps = Omit<
  Props,
  | 'i18n'
  | 'onSetSkinTone'
  | 'openCustomizePreferredReactionsModal'
  | 'preferredReactionEmoji'
  | 'selectionStyle'
  | 'skinTone'
>;

export const SmartReactionPicker = React.forwardRef<
  HTMLDivElement,
  ExternalProps
>((props, ref) => {
  const { openCustomizePreferredReactionsModal } =
    usePreferredReactionsActions();
  const { onSetSkinTone } = useItemsActions();

  const i18n = useSelector<StateType, LocalizerType>(getIntl);

  const preferredReactionEmoji = useSelector<StateType, Array<string>>(
    getPreferredReactionEmoji
  );

  return (
    <ReactionPicker
      i18n={i18n}
      onSetSkinTone={onSetSkinTone}
      openCustomizePreferredReactionsModal={
        openCustomizePreferredReactionsModal
      }
      preferredReactionEmoji={preferredReactionEmoji}
      ref={ref}
      {...props}
    />
  );
});
