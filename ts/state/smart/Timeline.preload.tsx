// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Timeline } from '../../components/conversation/Timeline.dom.js';
import { useCallingActions } from '../ducks/calling.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import {
  getConversationMessagesSelector,
  getConversationSelector,
  getHasContactSpoofingReview,
  getInvitedContactsForNewlyCreatedGroup,
  getMessages,
  getTargetedMessage,
} from '../selectors/conversations.dom.js';
import { getSelectedConversationId } from '../selectors/nav.std.js';
import { getIntl, getTheme } from '../selectors/user.std.js';
import type { PropsType as SmartContactSpoofingReviewDialogPropsType } from './ContactSpoofingReviewDialog.preload.js';
import { SmartContactSpoofingReviewDialog } from './ContactSpoofingReviewDialog.preload.js';
import { SmartHeroRow } from './HeroRow.preload.js';
import {
  SmartTimelineItem,
  type SmartTimelineItemProps,
} from './TimelineItem.preload.js';
import { SmartTypingBubble } from './TypingBubble.preload.js';
import { AttachmentDownloadManager } from '../../jobs/AttachmentDownloadManager.preload.js';
import { isInFullScreenCall as getIsInFullScreenCall } from '../selectors/calling.std.js';

type ExternalProps = {
  id: string;
};

function renderItem({
  containerElementRef,
  containerWidthBreakpoint,
  conversationId,
  interactivity,
  isBlocked,
  isGroup,
  isOldestTimelineItem,
  messageId,
  nextMessageId,
  previousMessageId,
  unreadIndicatorPlacement,
}: SmartTimelineItemProps): React.JSX.Element {
  return (
    <SmartTimelineItem
      containerElementRef={containerElementRef}
      containerWidthBreakpoint={containerWidthBreakpoint}
      conversationId={conversationId}
      interactivity={interactivity}
      isBlocked={isBlocked}
      isGroup={isGroup}
      isOldestTimelineItem={isOldestTimelineItem}
      messageId={messageId}
      previousMessageId={previousMessageId}
      nextMessageId={nextMessageId}
      unreadIndicatorPlacement={unreadIndicatorPlacement}
    />
  );
}

function renderContactSpoofingReviewDialog(
  props: SmartContactSpoofingReviewDialogPropsType
): React.JSX.Element {
  return <SmartContactSpoofingReviewDialog {...props} />;
}

function renderHeroRow(id: string): React.JSX.Element {
  return <SmartHeroRow id={id} />;
}
function renderTypingBubble(conversationId: string): React.JSX.Element {
  return <SmartTypingBubble conversationId={conversationId} />;
}

export const SmartTimeline = memo(function SmartTimeline({
  id,
}: ExternalProps) {
  const conversationMessagesSelector = useSelector(
    getConversationMessagesSelector
  );
  const conversationSelector = useSelector(getConversationSelector);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const hasContactSpoofingReview = useSelector(getHasContactSpoofingReview);
  const i18n = useSelector(getIntl);
  const invitedContactsForNewlyCreatedGroup = useSelector(
    getInvitedContactsForNewlyCreatedGroup
  );
  const messages = useSelector(getMessages);
  const selectedConversationId = useSelector(getSelectedConversationId);
  const targetedMessage = useSelector(getTargetedMessage);
  const theme = useSelector(getTheme);
  const isInFullScreenCall = useSelector(getIsInFullScreenCall);
  const conversation = conversationSelector(id);
  const conversationMessages = conversationMessagesSelector(id);

  const {
    clearInvitedServiceIdsForNewlyCreatedGroup,
    clearTargetedMessage,
    closeContactSpoofingReview,
    discardMessages,
    loadNewerMessages,
    loadNewestMessages,
    loadOlderMessages,
    markMessageRead,
    scrollToOldestUnreadMention,
    setCenterMessage,
    setIsNearBottom,
    targetMessage,
  } = useConversationsActions();
  const { maybePeekGroupCall } = useCallingActions();

  const getTimestampForMessage = useCallback(
    (messageId: string): undefined | number => {
      return messages[messageId]?.timestamp;
    },
    [messages]
  );

  const {
    acceptedMessageRequest,
    isBlocked = false,
    isGroupV1AndDisabled,
    removalStage,
    typingContactIdTimestamps = {},
    unreadCount,
    unreadMentionsCount,
    type: conversationType,
  } = conversation ?? {};
  const {
    haveNewest,
    haveOldest,
    isNearBottom,
    items,
    messageChangeCounter,
    messageLoadingState,
    oldestUnseenIndex,
    scrollToIndex,
    scrollToIndexCounter,
    totalUnseen,
  } = conversationMessages;

  const isConversationSelected = selectedConversationId === id;
  const isIncomingMessageRequest =
    !acceptedMessageRequest && removalStage !== 'justNotification';
  const isSomeoneTyping = Object.keys(typingContactIdTimestamps).length > 0;
  const targetedMessageId = targetedMessage?.id;

  return (
    <Timeline
      clearInvitedServiceIdsForNewlyCreatedGroup={
        clearInvitedServiceIdsForNewlyCreatedGroup
      }
      clearTargetedMessage={clearTargetedMessage}
      closeContactSpoofingReview={closeContactSpoofingReview}
      conversationType={conversationType}
      discardMessages={discardMessages}
      getPreferredBadge={getPreferredBadge}
      getTimestampForMessage={getTimestampForMessage}
      hasContactSpoofingReview={hasContactSpoofingReview}
      haveNewest={haveNewest}
      haveOldest={haveOldest}
      i18n={i18n}
      id={id}
      invitedContactsForNewlyCreatedGroup={invitedContactsForNewlyCreatedGroup}
      isBlocked={isBlocked}
      isConversationSelected={isConversationSelected}
      isGroupV1AndDisabled={isGroupV1AndDisabled}
      isInFullScreenCall={isInFullScreenCall}
      isIncomingMessageRequest={isIncomingMessageRequest}
      isNearBottom={isNearBottom}
      isSomeoneTyping={isSomeoneTyping}
      items={items}
      loadNewerMessages={loadNewerMessages}
      loadNewestMessages={loadNewestMessages}
      loadOlderMessages={loadOlderMessages}
      markMessageRead={markMessageRead}
      maybePeekGroupCall={maybePeekGroupCall}
      messageChangeCounter={messageChangeCounter}
      messageLoadingState={messageLoadingState}
      updateVisibleMessages={
        AttachmentDownloadManager.updateVisibleTimelineMessages
      }
      oldestUnseenIndex={oldestUnseenIndex}
      renderContactSpoofingReviewDialog={renderContactSpoofingReviewDialog}
      renderHeroRow={renderHeroRow}
      renderItem={renderItem}
      renderTypingBubble={renderTypingBubble}
      scrollToIndex={scrollToIndex}
      scrollToIndexCounter={scrollToIndexCounter}
      scrollToOldestUnreadMention={scrollToOldestUnreadMention}
      setCenterMessage={setCenterMessage}
      setIsNearBottom={setIsNearBottom}
      targetedMessageId={targetedMessageId}
      targetMessage={targetMessage}
      theme={theme}
      totalUnseen={totalUnseen}
      unreadCount={unreadCount}
      unreadMentionsCount={unreadMentionsCount}
    />
  );
});
