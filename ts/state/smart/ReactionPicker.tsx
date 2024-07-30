// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Ref } from 'react';
import React, { forwardRef, memo } from 'react';
import { useSelector } from 'react-redux';
import { usePreferredReactionsActions } from '../ducks/preferredReactions';
import { useItemsActions } from '../ducks/items';
import { getIntl } from '../selectors/user';
import { getPreferredReactionEmoji } from '../selectors/items';
import type { Props as InternalProps } from '../../components/conversation/ReactionPicker';
import { ReactionPicker } from '../../components/conversation/ReactionPicker';

type ExternalProps = Omit<
  InternalProps,
  | 'i18n'
  | 'onSetSkinTone'
  | 'openCustomizePreferredReactionsModal'
  | 'preferredReactionEmoji'
  | 'selectionStyle'
  | 'skinTone'
>;

export const SmartReactionPicker = memo(
  forwardRef(function SmartReactionPickerInner(
    props: ExternalProps,
    ref: Ref<HTMLDivElement>
  ) {
    const { openCustomizePreferredReactionsModal } =
      usePreferredReactionsActions();

    const { onSetSkinTone } = useItemsActions();

    const i18n = useSelector(getIntl);
    const preferredReactionEmoji = useSelector(getPreferredReactionEmoji);

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
  })
);
