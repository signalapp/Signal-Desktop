// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { StoryViewer } from '../../components/StoryViewer';
import { ToastType } from '../../types/Toast';
import { useToastActions } from '../ducks/toast';
import { getConversationSelector } from '../selectors/conversations';
import {
  getEmojiSkinTone,
  getHasStoryViewReceiptSetting,
  getPreferredReactionEmoji,
  getTextFormattingEnabled,
  isInternalUser,
} from '../selectors/items';
import { getIntl, getPlatform } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getSelectedStoryData,
  getStoryReplies,
  getStoryByIdSelector,
  getHasAllStoriesUnmuted,
} from '../selectors/stories';
import { isInFullScreenCall } from '../selectors/calling';
import { isSignalConversation } from '../../util/isSignalConversation';
import { renderEmojiPicker } from './renderEmojiPicker';
import { strictAssert } from '../../util/assert';
import { asyncShouldNeverBeCalled } from '../../util/shouldNeverBeCalled';
import { useEmojisActions } from '../ducks/emojis';
import { useConversationsActions } from '../ducks/conversations';
import { useRecentEmojis } from '../selectors/emojis';
import { useItemsActions } from '../ducks/items';
import { useAudioPlayerActions } from '../ducks/audioPlayer';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useStoriesActions } from '../ducks/stories';
import { useIsWindowActive } from '../../hooks/useIsWindowActive';

export const SmartStoryViewer = memo(function SmartStoryViewer() {
  const storiesActions = useStoriesActions();
  const { onUseEmoji } = useEmojisActions();
  const {
    retryMessageSend,
    saveAttachment,
    showConversation,
    toggleHideStories,
  } = useConversationsActions();
  const { onSetSkinTone } = useItemsActions();
  const { showToast } = useToastActions();
  const { showContactModal } = useGlobalModalActions();

  const isWindowActive = useIsWindowActive();

  const i18n = useSelector(getIntl);
  const platform = useSelector(getPlatform);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const preferredReactionEmoji = useSelector(getPreferredReactionEmoji);
  const selectedStoryData = useSelector(getSelectedStoryData);
  const internalUser = useSelector(isInternalUser);

  strictAssert(selectedStoryData, 'StoryViewer: !selectedStoryData');

  const conversationSelector = useSelector(getConversationSelector);

  const getStoryById = useSelector(getStoryByIdSelector);
  const recentEmojis = useRecentEmojis();
  const skinTone = useSelector(getEmojiSkinTone);
  const replyState = useSelector(getStoryReplies);
  const hasAllStoriesUnmuted = useSelector(getHasAllStoriesUnmuted);
  const hasActiveCall = useSelector(isInFullScreenCall);
  const hasViewReceiptSetting = useSelector(getHasStoryViewReceiptSetting);
  const isFormattingEnabled = useSelector(getTextFormattingEnabled);

  const { pauseVoiceNotePlayer } = useAudioPlayerActions();

  const storyInfo = getStoryById(
    conversationSelector,
    selectedStoryData.messageId
  );

  if (!storyInfo) {
    return null;
  }

  const { conversationStory, distributionList, storyView } = storyInfo;

  return (
    <StoryViewer
      currentIndex={selectedStoryData.currentIndex}
      distributionList={distributionList}
      getPreferredBadge={getPreferredBadge}
      group={conversationStory.group}
      hasActiveCall={hasActiveCall}
      hasAllStoriesUnmuted={hasAllStoriesUnmuted}
      hasViewReceiptSetting={hasViewReceiptSetting}
      i18n={i18n}
      platform={platform}
      isInternalUser={internalUser}
      isFormattingEnabled={isFormattingEnabled}
      isSignalConversation={isSignalConversation({
        id: conversationStory.conversationId,
      })}
      isWindowActive={isWindowActive}
      numStories={selectedStoryData.numStories}
      onHideStory={toggleHideStories}
      onGoToConversation={senderId => {
        showConversation({ conversationId: senderId });
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
      onTextTooLong={() => {
        showToast({ toastType: ToastType.MessageBodyTooLong });
      }}
      onUseEmoji={onUseEmoji}
      onMediaPlaybackStart={pauseVoiceNotePlayer}
      preferredReactionEmoji={preferredReactionEmoji}
      recentEmojis={recentEmojis}
      renderEmojiPicker={renderEmojiPicker}
      replyState={replyState}
      retryMessageSend={retryMessageSend}
      saveAttachment={internalUser ? saveAttachment : asyncShouldNeverBeCalled}
      showContactModal={showContactModal}
      showToast={showToast}
      skinTone={skinTone}
      story={storyView}
      storyViewMode={selectedStoryData.storyViewMode}
      viewTarget={selectedStoryData.viewTarget}
      {...storiesActions}
    />
  );
});
