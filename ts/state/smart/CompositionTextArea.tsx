// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type { CompositionTextAreaProps } from '../../components/CompositionTextArea';
import { CompositionTextArea } from '../../components/CompositionTextArea';
import { getIntl, getPlatform, getUserConversationId } from '../selectors/user';
import { useEmojisActions as useEmojiActions } from '../ducks/emojis';
import { useItemsActions } from '../ducks/items';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { useComposerActions } from '../ducks/composer';
import { getTextFormattingEnabled } from '../selectors/items';

export type SmartCompositionTextAreaProps = Pick<
  CompositionTextAreaProps,
  | 'bodyRanges'
  | 'draftText'
  | 'isActive'
  | 'placeholder'
  | 'onChange'
  | 'onScroll'
  | 'onSubmit'
  | 'theme'
  | 'maxLength'
  | 'whenToShowRemainingCount'
>;

export const SmartCompositionTextArea = memo(function SmartCompositionTextArea(
  props: SmartCompositionTextAreaProps
) {
  const i18n = useSelector(getIntl);
  const platform = useSelector(getPlatform);
  const ourConversationId = useSelector(getUserConversationId);

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
      isActive
      isFormattingEnabled={isFormattingEnabled}
      onPickEmoji={onPickEmoji}
      onSetSkinTone={onSetSkinTone}
      onTextTooLong={onTextTooLong}
      platform={platform}
      ourConversationId={ourConversationId}
    />
  );
});
