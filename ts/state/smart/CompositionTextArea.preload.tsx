// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { CompositionTextAreaProps } from '../../components/CompositionTextArea.dom.tsx';
import { CompositionTextArea } from '../../components/CompositionTextArea.dom.tsx';
import type {
  DraftBodyRanges,
  HydratedBodyRangesType,
} from '../../types/BodyRange.std.ts';
import { hydrateRanges } from '../../util/BodyRange.node.ts';
import {
  getIntl,
  getPlatform,
  getUserConversationId,
} from '../selectors/user.std.ts';
import { useEmojisActions as useEmojiActions } from '../ducks/emojis.preload.ts';
import { useItemsActions } from '../ducks/items.preload.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import { useComposerActions } from '../ducks/composer.preload.ts';
import { getTextFormattingEnabled } from '../selectors/items.dom.ts';
import { getConversationSelector } from '../selectors/conversations.dom.ts';

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

  const convertDraftBodyRangesIntoHydrated = useCallback(
    (
      bodyRanges: DraftBodyRanges | undefined
    ): HydratedBodyRangesType | undefined => {
      return hydrateRanges(bodyRanges, conversationSelector);
    },
    [conversationSelector]
  );

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
      convertDraftBodyRangesIntoHydrated={convertDraftBodyRangesIntoHydrated}
    />
  );
});
