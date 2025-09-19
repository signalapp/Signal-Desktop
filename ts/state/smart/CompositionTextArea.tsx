// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type { CompositionTextAreaProps } from '../../components/CompositionTextArea.js';
import { CompositionTextArea } from '../../components/CompositionTextArea.js';
import {
  getIntl,
  getPlatform,
  getUserConversationId,
} from '../selectors/user.js';
import { useEmojisActions as useEmojiActions } from '../ducks/emojis.js';
import { useItemsActions } from '../ducks/items.js';
import { getPreferredBadgeSelector } from '../selectors/badges.js';
import { useComposerActions } from '../ducks/composer.js';
import { getTextFormattingEnabled } from '../selectors/items.js';
import { getConversationSelector } from '../selectors/conversations.js';

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
  | 'emojiSkinToneDefault'
>;

export const SmartCompositionTextArea = memo(function SmartCompositionTextArea(
  props: SmartCompositionTextAreaProps
) {
  const i18n = useSelector(getIntl);
  const platform = useSelector(getPlatform);
  const ourConversationId = useSelector(getUserConversationId);

  const { onUseEmoji: onPickEmoji } = useEmojiActions();
  const { setEmojiSkinToneDefault } = useItemsActions();
  const { onTextTooLong } = useComposerActions();

  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const isFormattingEnabled = useSelector(getTextFormattingEnabled);
  const conversationSelector = useSelector(getConversationSelector);

  return (
    <CompositionTextArea
      {...props}
      getPreferredBadge={getPreferredBadge}
      i18n={i18n}
      isActive
      isFormattingEnabled={isFormattingEnabled}
      onPickEmoji={onPickEmoji}
      onEmojiSkinToneDefaultChange={setEmojiSkinToneDefault}
      onTextTooLong={onTextTooLong}
      platform={platform}
      ourConversationId={ourConversationId}
      conversationSelector={conversationSelector}
    />
  );
});
