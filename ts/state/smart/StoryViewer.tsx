// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { LocalizerType } from '../../types/Util';
import type { StateType } from '../reducer';
import type { StoryViewType } from '../../components/StoryListItem';
import { StoryViewer } from '../../components/StoryViewer';
import { ToastMessageBodyTooLong } from '../../components/ToastMessageBodyTooLong';
import {
  getEmojiSkinTone,
  getPreferredReactionEmoji,
} from '../selectors/items';
import { getIntl } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { renderEmojiPicker } from './renderEmojiPicker';
import { showToast } from '../../util/showToast';
import { useActions as useEmojisActions } from '../ducks/emojis';
import { useActions as useItemsActions } from '../ducks/items';
import { useRecentEmojis } from '../selectors/emojis';
import { useStoriesActions } from '../ducks/stories';

export type PropsType = {
  conversationId: string;
  onClose: () => unknown;
  onNextUserStories: () => unknown;
  onPrevUserStories: () => unknown;
  stories: Array<StoryViewType>;
};

export function SmartStoryViewer({
  conversationId,
  onClose,
  onNextUserStories,
  onPrevUserStories,
  stories,
}: PropsType): JSX.Element | null {
  const storiesActions = useStoriesActions();
  const { onSetSkinTone } = useItemsActions();
  const { onUseEmoji } = useEmojisActions();

  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const preferredReactionEmoji = useSelector<StateType, Array<string>>(
    getPreferredReactionEmoji
  );

  const recentEmojis = useRecentEmojis();
  const skinTone = useSelector<StateType, number>(getEmojiSkinTone);

  return (
    <StoryViewer
      getPreferredBadge={getPreferredBadge}
      i18n={i18n}
      onClose={onClose}
      onNextUserStories={onNextUserStories}
      onPrevUserStories={onPrevUserStories}
      onReactToStory={async (emoji, story) => {
        const { messageId, selectedReaction: previousReaction } = story;
        storiesActions.reactToStory(emoji, messageId, previousReaction);
      }}
      onReplyToStory={(message, mentions, timestamp, story) => {
        storiesActions.replyToStory(
          conversationId,
          message,
          mentions,
          timestamp,
          story
        );
      }}
      onSetSkinTone={onSetSkinTone}
      onTextTooLong={() => showToast(ToastMessageBodyTooLong)}
      onUseEmoji={onUseEmoji}
      preferredReactionEmoji={preferredReactionEmoji}
      recentEmojis={recentEmojis}
      renderEmojiPicker={renderEmojiPicker}
      stories={stories}
      skinTone={skinTone}
      {...storiesActions}
    />
  );
}
