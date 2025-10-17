// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { StoryViewer } from '../../components/StoryViewer.dom.js';
import { ToastType } from '../../types/Toast.dom.js';
import { useToastActions } from '../ducks/toast.preload.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';
import {
  getEmojiSkinToneDefault,
  getHasStoryViewReceiptSetting,
  getPreferredReactionEmoji,
  getTextFormattingEnabled,
  isInternalUser,
} from '../selectors/items.dom.js';
import {
  getIntl,
  getPlatform,
  getUserConversationId,
} from '../selectors/user.std.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import {
  getSelectedStoryData,
  getStoryReplies,
  getStoryByIdSelector,
  getHasAllStoriesUnmuted,
} from '../selectors/stories.preload.js';
import { isInFullScreenCall } from '../selectors/calling.std.js';
import { isSignalConversation as getIsSignalConversation } from '../../util/isSignalConversation.dom.js';
import { strictAssert } from '../../util/assert.std.js';
import { asyncShouldNeverBeCalled } from '../../util/shouldNeverBeCalled.std.js';
import { useEmojisActions } from '../ducks/emojis.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useAudioPlayerActions } from '../ducks/audioPlayer.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useStoriesActions } from '../ducks/stories.preload.js';
import { useIsWindowActive } from '../../hooks/useIsWindowActive.dom.js';
import type { DraftBodyRanges } from '../../types/BodyRange.std.js';
import type { StoryViewType } from '../../types/Stories.std.js';

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
  const emojiSkinToneDefault = useSelector(getEmojiSkinToneDefault);
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
    async (emoji: string, story: StoryViewType) => {
      const { messageId } = story;
      reactToStory(emoji, messageId);
    },
    [reactToStory]
  );
  const handleReplyToStory = useCallback(
    (
      message: string,
      bodyRanges: DraftBodyRanges,
      timestamp: number,
      story: StoryViewType
    ) => {
      const conversationId = storyInfo?.conversationStory?.conversationId;
      strictAssert(conversationId != null, 'conversationId is required');
      replyToStory(conversationId, message, bodyRanges, timestamp, story);
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
      onTextTooLong={handleTextTooLong}
      onSelectEmoji={onUseEmoji}
      ourConversationId={ourConversationId}
      platform={platform}
      preferredReactionEmoji={preferredReactionEmoji}
      queueStoryDownload={queueStoryDownload}
      replyState={replyState}
      retryMessageSend={retryMessageSend}
      saveAttachment={internalUser ? saveAttachment : asyncShouldNeverBeCalled}
      setHasAllStoriesUnmuted={setHasAllStoriesUnmuted}
      showContactModal={showContactModal}
      showToast={showToast}
      emojiSkinToneDefault={emojiSkinToneDefault}
      story={storyView}
      storyViewMode={selectedStoryData.storyViewMode}
      viewStory={viewStory}
      viewTarget={selectedStoryData.viewTarget}
    />
  );
});
