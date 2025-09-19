// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Ref } from 'react';
import React, { forwardRef, memo } from 'react';
import { useSelector } from 'react-redux';
import { usePreferredReactionsActions } from '../ducks/preferredReactions.js';
import { useItemsActions } from '../ducks/items.js';
import { getIntl } from '../selectors/user.js';
import { getPreferredReactionEmoji } from '../selectors/items.js';
import type { Props as InternalProps } from '../../components/conversation/ReactionPicker.js';
import { ReactionPicker } from '../../components/conversation/ReactionPicker.js';

type ExternalProps = Omit<
  InternalProps,
  | 'i18n'
  | 'onEmojiSkinToneDefaultChange'
  | 'openCustomizePreferredReactionsModal'
  | 'preferredReactionEmoji'
  | 'selectionStyle'
  | 'emojiSkinToneDefault'
>;

export const SmartReactionPicker = memo(
  forwardRef(function SmartReactionPickerInner(
    props: ExternalProps,
    ref: Ref<HTMLDivElement>
  ) {
    const { openCustomizePreferredReactionsModal } =
      usePreferredReactionsActions();

    const { setEmojiSkinToneDefault } = useItemsActions();

    const i18n = useSelector(getIntl);
    const preferredReactionEmoji = useSelector(getPreferredReactionEmoji);

    return (
      <ReactionPicker
        i18n={i18n}
        onEmojiSkinToneDefaultChange={setEmojiSkinToneDefault}
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
