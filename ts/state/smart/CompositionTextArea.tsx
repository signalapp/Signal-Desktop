// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import type { CompositionTextAreaProps } from '../../components/CompositionTextArea';
import { CompositionTextArea } from '../../components/CompositionTextArea';
import { getIntl, getPlatform } from '../selectors/user';
import { useActions as useEmojiActions } from '../ducks/emojis';
import { useItemsActions } from '../ducks/items';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { useComposerActions } from '../ducks/composer';
import { getTextFormattingEnabled } from '../selectors/items';

export type SmartCompositionTextAreaProps = Pick<
  CompositionTextAreaProps,
  | 'bodyRanges'
  | 'draftText'
  | 'placeholder'
  | 'onChange'
  | 'onScroll'
  | 'onSubmit'
  | 'theme'
  | 'maxLength'
  | 'whenToShowRemainingCount'
  | 'scrollerRef'
>;

export function SmartCompositionTextArea(
  props: SmartCompositionTextAreaProps
): JSX.Element {
  const i18n = useSelector(getIntl);
  const platform = useSelector(getPlatform);

  const { onUseEmoji: onPickEmoji } = useEmojiActions();
  const { onSetSkinTone } = useItemsActions();
  const { onTextTooLong } = useComposerActions();

  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const isFormattingEnabled = useSelector(getTextFormattingEnabled);

  return (
    <CompositionTextArea
      {...props}
      getPreferredBadge={getPreferredBadge}
      i18n={i18n}
      isFormattingEnabled={isFormattingEnabled}
      onPickEmoji={onPickEmoji}
      onSetSkinTone={onSetSkinTone}
      onTextTooLong={onTextTooLong}
      platform={platform}
    />
  );
}
