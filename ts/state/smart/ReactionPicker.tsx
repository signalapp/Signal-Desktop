// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Ref } from 'react';
import React, { forwardRef, memo } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user.std.js';
import { getPreferredReactionEmoji } from '../selectors/items.dom.js';
import type { Props as InternalProps } from '../../components/conversation/ReactionPicker.dom.js';
import { ReactionPicker } from '../../components/conversation/ReactionPicker.dom.js';

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
    const i18n = useSelector(getIntl);
    const preferredReactionEmoji = useSelector(getPreferredReactionEmoji);

    return (
      <ReactionPicker
        i18n={i18n}
        preferredReactionEmoji={preferredReactionEmoji}
        ref={ref}
        {...props}
      />
    );
  })
);
