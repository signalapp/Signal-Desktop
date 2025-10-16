// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type { CompositionTextAreaProps } from '../../components/CompositionTextArea.dom.js';
import { CompositionTextArea } from '../../components/CompositionTextArea.dom.js';
import {
  getIntl,
  getPlatform,
  getUserConversationId,
} from '../selectors/user.std.js';
import { useEmojisActions as useEmojiActions } from '../ducks/emojis.preload.js';
import { useItemsActions } from '../ducks/items.preload.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import { useComposerActions } from '../ducks/composer.preload.js';
import { getTextFormattingEnabled } from '../selectors/items.dom.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';

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

  const { onUseEmoji } = useEmojiActions();
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
      onSelectEmoji={onUseEmoji}
      onEmojiSkinToneDefaultChange={setEmojiSkinToneDefault}
      onTextTooLong={onTextTooLong}
      platform={platform}
      ourConversationId={ourConversationId}
      conversationSelector={conversationSelector}
    />
  );
});
