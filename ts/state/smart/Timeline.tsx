// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEmpty } from 'lodash';
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { ReadonlyDeep } from 'type-fest';
import type { WarningType as TimelineWarningType } from '../../components/conversation/Timeline';
import { Timeline } from '../../components/conversation/Timeline';
import { ContactSpoofingType } from '../../util/contactSpoofing';
import { getGroupMemberships } from '../../util/getGroupMemberships';
import {
  dehydrateCollisionsWithConversations,
  getCollisionsFromMemberships,
} from '../../util/groupMemberNameCollisions';
import { missingCaseError } from '../../util/missingCaseError';
import { useCallingActions } from '../ducks/calling';
import {
  useConversationsActions,
  type ConversationType,
} from '../ducks/conversations';
import type { StateType } from '../reducer';
import { selectAudioPlayerActive } from '../selectors/audioPlayer';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getConversationByServiceIdSelector,
  getConversationMessagesSelector,
  getConversationSelector,
  getHasContactSpoofingReview,
  getInvitedContactsForNewlyCreatedGroup,
  getMessages,
  getSafeConversationWithSameTitle,
  getSelectedConversationId,
  getTargetedMessage,
} from '../selectors/conversations';
import { getIntl, getTheme } from '../selectors/user';
import type { PropsType as SmartCollidingAvatarsPropsType } from './CollidingAvatars';
import { SmartCollidingAvatars } from './CollidingAvatars';
import type { PropsType as SmartContactSpoofingReviewDialogPropsType } from './ContactSpoofingReviewDialog';
import { SmartContactSpoofingReviewDialog } from './ContactSpoofingReviewDialog';
import { SmartHeroRow } from './HeroRow';
import { SmartMiniPlayer } from './MiniPlayer';
import { SmartTimelineItem, type SmartTimelineItemProps } from './TimelineItem';
import { SmartTypingBubble } from './TypingBubble';
import { AttachmentDownloadManager } from '../../jobs/AttachmentDownloadManager';

type ExternalProps = {
  id: string;
};

function renderItem({
  containerElementRef,
  containerWidthBreakpoint,
  conversationId,
  isBlocked,
  isGroup,
  isOldestTimelineItem,
  messageId,
  nextMessageId,
  previousMessageId,
  unreadIndicatorPlacement,
}: SmartTimelineItemProps): JSX.Element {
  return (
    <SmartTimelineItem
      containerElementRef={containerElementRef}
      containerWidthBreakpoint={containerWidthBreakpoint}
      conversationId={conversationId}
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

function renderCollidingAvatars(
  props: SmartCollidingAvatarsPropsType
): JSX.Element {
  return <SmartCollidingAvatars {...props} />;
}

function renderContactSpoofingReviewDialog(
  props: SmartContactSpoofingReviewDialogPropsType
): JSX.Element {
  return <SmartContactSpoofingReviewDialog {...props} />;
}

function renderHeroRow(id: string): JSX.Element {
  return <SmartHeroRow id={id} />;
}
function renderMiniPlayer(options: { shouldFlow: boolean }): JSX.Element {
  return <SmartMiniPlayer {...options} />;
}
function renderTypingBubble(conversationId: string): JSX.Element {
  return <SmartTypingBubble conversationId={conversationId} />;
}

const getWarning = (
  conversation: ReadonlyDeep<ConversationType>,
  state: Readonly<StateType>
): undefined | TimelineWarningType => {
  switch (conversation.type) {
    case 'direct':
      if (!conversation.acceptedMessageRequest && !conversation.isBlocked) {
        const safeConversation = getSafeConversationWithSameTitle(state, {
          possiblyUnsafeConversation: conversation,
        });

        if (safeConversation) {
          return {
            type: ContactSpoofingType.DirectConversationWithSameTitle,
            safeConversationId: safeConversation.id,
          };
        }
      }
      return undefined;
    case 'group': {
      if (conversation.left || conversation.groupVersion !== 2) {
        return undefined;
      }

      const getConversationByServiceId =
        getConversationByServiceIdSelector(state);

      const { memberships } = getGroupMemberships(
        conversation,
        getConversationByServiceId
      );
      const groupNameCollisions = getCollisionsFromMemberships(memberships);
      const hasGroupMembersWithSameName = !isEmpty(groupNameCollisions);
      if (hasGroupMembersWithSameName) {
        return {
          type: ContactSpoofingType.MultipleGroupMembersWithSameTitle,
          acknowledgedGroupNameCollisions:
            conversation.acknowledgedGroupNameCollisions,
          groupNameCollisions:
            dehydrateCollisionsWithConversations(groupNameCollisions),
        };
      }

      return undefined;
    }
    default:
      throw missingCaseError(conversation);
  }
};

export const SmartTimeline = memo(function SmartTimeline({
  id,
}: ExternalProps) {
  const activeAudioPlayer = useSelector(selectAudioPlayerActive);
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

  const conversation = conversationSelector(id);
  const conversationMessages = conversationMessagesSelector(id);

  const warning = useSelector(
    useCallback(
      (state: StateType) => {
        return getWarning(conversation, state);
      },
      [conversation]
    )
  );

  const {
    acknowledgeGroupMemberNameCollisions,
    clearInvitedServiceIdsForNewlyCreatedGroup,
    clearTargetedMessage,
    closeContactSpoofingReview,
    discardMessages,
    loadNewerMessages,
    loadNewestMessages,
    loadOlderMessages,
    markMessageRead,
    reviewConversationNameCollision,
    scrollToOldestUnreadMention,
    setIsNearBottom,
    targetMessage,
  } = useConversationsActions();
  const { peekGroupCallForTheFirstTime, peekGroupCallIfItHasMembers } =
    useCallingActions();

  const getTimestampForMessage = useCallback(
    (messageId: string): undefined | number => {
      return messages[messageId]?.timestamp;
    },
    [messages]
  );

  const shouldShowMiniPlayer = activeAudioPlayer != null;
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
      acknowledgeGroupMemberNameCollisions={
        acknowledgeGroupMemberNameCollisions
      }
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
      isIncomingMessageRequest={isIncomingMessageRequest}
      isNearBottom={isNearBottom}
      isSomeoneTyping={isSomeoneTyping}
      items={items}
      loadNewerMessages={loadNewerMessages}
      loadNewestMessages={loadNewestMessages}
      loadOlderMessages={loadOlderMessages}
      markMessageRead={markMessageRead}
      messageChangeCounter={messageChangeCounter}
      messageLoadingState={messageLoadingState}
      updateVisibleMessages={
        AttachmentDownloadManager.updateVisibleTimelineMessages
      }
      oldestUnseenIndex={oldestUnseenIndex}
      peekGroupCallForTheFirstTime={peekGroupCallForTheFirstTime}
      peekGroupCallIfItHasMembers={peekGroupCallIfItHasMembers}
      renderCollidingAvatars={renderCollidingAvatars}
      renderContactSpoofingReviewDialog={renderContactSpoofingReviewDialog}
      renderHeroRow={renderHeroRow}
      renderItem={renderItem}
      renderMiniPlayer={renderMiniPlayer}
      renderTypingBubble={renderTypingBubble}
      reviewConversationNameCollision={reviewConversationNameCollision}
      scrollToIndex={scrollToIndex}
      scrollToIndexCounter={scrollToIndexCounter}
      scrollToOldestUnreadMention={scrollToOldestUnreadMention}
      setIsNearBottom={setIsNearBottom}
      shouldShowMiniPlayer={shouldShowMiniPlayer}
      targetedMessageId={targetedMessageId}
      targetMessage={targetMessage}
      theme={theme}
      totalUnseen={totalUnseen}
      unreadCount={unreadCount}
      unreadMentionsCount={unreadMentionsCount}
      warning={warning}
    />
  );
});
