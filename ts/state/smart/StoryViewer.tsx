// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { GetConversationByIdType } from '../selectors/conversations';
import type { LocalizerType } from '../../types/Util';
import type { StoryViewModeType } from '../../types/Stories';
import type { StateType } from '../reducer';
import type { SelectedStoryDataType } from '../ducks/stories';
import { StoryViewer } from '../../components/StoryViewer';
import { ToastMessageBodyTooLong } from '../../components/ToastMessageBodyTooLong';
import { getConversationSelector } from '../selectors/conversations';
import {
  getEmojiSkinTone,
  getHasAllStoriesMuted,
  getPreferredReactionEmoji,
} from '../selectors/items';
import { getIntl } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getConversationStory,
  getSelectedStoryData,
  getStoryReplies,
  getStoryView,
} from '../selectors/stories';
import { renderEmojiPicker } from './renderEmojiPicker';
import { showToast } from '../../util/showToast';
import { strictAssert } from '../../util/assert';
import { useActions as useEmojisActions } from '../ducks/emojis';
import { useActions as useItemsActions } from '../ducks/items';
import { useConversationsActions } from '../ducks/conversations';
import { useRecentEmojis } from '../selectors/emojis';
import { useStoriesActions } from '../ducks/stories';

export function SmartStoryViewer(): JSX.Element | null {
  const storiesActions = useStoriesActions();
  const { onSetSkinTone, toggleHasAllStoriesMuted } = useItemsActions();
  const { onUseEmoji } = useEmojisActions();
  const { showConversation, toggleHideStories } = useConversationsActions();

  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const preferredReactionEmoji = useSelector<StateType, Array<string>>(
    getPreferredReactionEmoji
  );

  const selectedStoryData = useSelector<
    StateType,
    SelectedStoryDataType | undefined
  >(getSelectedStoryData);

  strictAssert(selectedStoryData, 'StoryViewer: !selectedStoryData');

  const conversationSelector = useSelector<StateType, GetConversationByIdType>(
    getConversationSelector
  );

  const storyView = getStoryView(conversationSelector, selectedStoryData.story);
  const conversationStory = getConversationStory(
    conversationSelector,
    selectedStoryData.story
  );
  const storyViewMode = useSelector<StateType, StoryViewModeType | undefined>(
    state => state.stories.storyViewMode
  );

  const recentEmojis = useRecentEmojis();
  const skinTone = useSelector<StateType, number>(getEmojiSkinTone);
  const replyState = useSelector(getStoryReplies);
  const hasAllStoriesMuted = useSelector<StateType, boolean>(
    getHasAllStoriesMuted
  );

  return (
    <StoryViewer
      currentIndex={selectedStoryData.currentIndex}
      getPreferredBadge={getPreferredBadge}
      group={conversationStory.group}
      hasAllStoriesMuted={hasAllStoriesMuted}
      i18n={i18n}
      numStories={selectedStoryData.numStories}
      onHideStory={toggleHideStories}
      onGoToConversation={senderId => {
        showConversation({ conversationId: senderId });
        storiesActions.toggleStoriesView();
      }}
      onReactToStory={async (emoji, story) => {
        const { messageId } = story;
        storiesActions.reactToStory(emoji, messageId);
      }}
      onReplyToStory={(message, mentions, timestamp, story) => {
        storiesActions.replyToStory(
          conversationStory.conversationId,
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
      replyState={replyState}
      skinTone={skinTone}
      story={storyView}
      storyViewMode={storyViewMode}
      toggleHasAllStoriesMuted={toggleHasAllStoriesMuted}
      {...storiesActions}
    />
  );
}
