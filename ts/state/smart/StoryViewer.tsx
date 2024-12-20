// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
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
import { getIntl, getPlatform, getUserConversationId } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getSelectedStoryData,
  getStoryReplies,
  getStoryByIdSelector,
  getHasAllStoriesUnmuted,
} from '../selectors/stories';
import { isInFullScreenCall } from '../selectors/calling';
import { isSignalConversation as getIsSignalConversation } from '../../util/isSignalConversation';
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
  const {
    reactToStory,
    replyToStory,
    deleteGroupStoryReply,
    deleteGroupStoryReplyForEveryone,
    deleteStoryForEveryone,
    loadStoryReplies,
    markStoryRead,
    queueStoryDownload,
    setHasAllStoriesUnmuted,
    viewStory,
  } = useStoriesActions();
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
  const ourConversationId = useSelector(getUserConversationId);
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

  const handleGoToConversation = useCallback(
    (senderId: string) => {
      showConversation({ conversationId: senderId });
    },
    [showConversation]
  );

  const handleReactToStory = useCallback(
    async (emoji, story) => {
      const { messageId } = story;
      reactToStory(emoji, messageId);
    },
    [reactToStory]
  );
  const handleReplyToStory = useCallback(
    (message, mentions, timestamp, story) => {
      const conversationId = storyInfo?.conversationStory?.conversationId;
      strictAssert(conversationId != null, 'conversationId is required');
      replyToStory(conversationId, message, mentions, timestamp, story);
    },
    [storyInfo, replyToStory]
  );
  const handleTextTooLong = useCallback(() => {
    showToast({ toastType: ToastType.MessageBodyTooLong });
  }, [showToast]);

  if (!storyInfo) {
    return null;
  }

  const { conversationStory, distributionList, storyView } = storyInfo;
  const { group, conversationId } = conversationStory;

  const isSignalConversation = getIsSignalConversation({
    id: conversationId,
  });

  return (
    <StoryViewer
      currentIndex={selectedStoryData.currentIndex}
      deleteGroupStoryReply={deleteGroupStoryReply}
      deleteGroupStoryReplyForEveryone={deleteGroupStoryReplyForEveryone}
      deleteStoryForEveryone={deleteStoryForEveryone}
      distributionList={distributionList}
      getPreferredBadge={getPreferredBadge}
      group={group}
      hasActiveCall={hasActiveCall}
      hasAllStoriesUnmuted={hasAllStoriesUnmuted}
      hasViewReceiptSetting={hasViewReceiptSetting}
      i18n={i18n}
      isFormattingEnabled={isFormattingEnabled}
      isInternalUser={internalUser}
      isSignalConversation={isSignalConversation}
      isWindowActive={isWindowActive}
      loadStoryReplies={loadStoryReplies}
      markStoryRead={markStoryRead}
      numStories={selectedStoryData.numStories}
      onGoToConversation={handleGoToConversation}
      onHideStory={toggleHideStories}
      onMediaPlaybackStart={pauseVoiceNotePlayer}
      onReactToStory={handleReactToStory}
      onReplyToStory={handleReplyToStory}
      onSetSkinTone={onSetSkinTone}
      onTextTooLong={handleTextTooLong}
      onUseEmoji={onUseEmoji}
      ourConversationId={ourConversationId}
      platform={platform}
      preferredReactionEmoji={preferredReactionEmoji}
      queueStoryDownload={queueStoryDownload}
      recentEmojis={recentEmojis}
      renderEmojiPicker={renderEmojiPicker}
      replyState={replyState}
      retryMessageSend={retryMessageSend}
      saveAttachment={internalUser ? saveAttachment : asyncShouldNeverBeCalled}
      setHasAllStoriesUnmuted={setHasAllStoriesUnmuted}
      showContactModal={showContactModal}
      showToast={showToast}
      skinTone={skinTone}
      story={storyView}
      storyViewMode={selectedStoryData.storyViewMode}
      viewStory={viewStory}
      viewTarget={selectedStoryData.viewTarget}
    />
  );
});
