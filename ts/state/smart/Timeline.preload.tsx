// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { isEqual } from 'lodash';

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
import { SmartContactSpoofingReviewDialog } from './ContactSpoofingReviewDialog.preload.js';
import { SmartHeroRow } from './HeroRow.preload.js';
import { SmartTimelineItem } from './TimelineItem.preload.js';
import { SmartTypingBubble } from './TypingBubble.preload.js';
import { AttachmentDownloadManager } from '../../jobs/AttachmentDownloadManager.preload.js';
import {
  getActiveCall,
  getCallSelector,
  isInFullScreenCall as getIsInFullScreenCall,
} from '../selectors/calling.std.js';
import { getMidnight } from '../../types/NotificationProfile.std.js';

import type { PropsType as SmartContactSpoofingReviewDialogPropsType } from './ContactSpoofingReviewDialog.preload.js';
import type { RenderItemProps } from './TimelineItem.preload.js';
import { getCallHistorySelector } from '../selectors/callHistory.std.js';
import { getCallIdFromEra } from '../../util/callDisposition.preload.js';
import { mapItemsIntoCollapseSets } from '../../util/CollapseSet.std.js';
import type { CollapseSet } from '../../util/CollapseSet.std.js';

type ExternalProps = {
  id: string;
};

function renderItem(props: RenderItemProps): React.JSX.Element {
  return (
    <SmartTimelineItem key={props.item.id} {...props} renderItem={renderItem} />
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
  const callHistorySelector = useSelector(getCallHistorySelector);
  const activeCall = useSelector(getActiveCall);
  const callSelector = useSelector(getCallSelector);

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
    terminated: isGroupTerminated = false,
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

  const previousCollapseSet = React.useRef<Array<CollapseSet> | undefined>(
    undefined
  );
  const midnightToday = getMidnight(Date.now());
  const { collapseSets, updatedOldestLastSeenIndex, updatedScrollToIndex } =
    React.useMemo(() => {
      const result = mapItemsIntoCollapseSets({
        activeCall,
        allowMultidaySets: false,
        callHistorySelector,
        callSelector,
        getCallIdFromEra,
        items,
        messages,
        midnightToday,
        oldestUnseenIndex,
        scrollToIndex,
      });

      const { resultUnseenIndex, resultScrollToIndex } = result;
      let { resultSets } = result;

      // Params messages changes a lot, items less often, call selectors possibly a lot.
      // But we need to massage items based on the values from these params. So, if we
      // generate the same data, we would like to return the same object.
      if (
        previousCollapseSet.current &&
        isEqual(resultSets, previousCollapseSet.current)
      ) {
        resultSets = previousCollapseSet.current;
      }

      previousCollapseSet.current = resultSets;

      return {
        collapseSets: resultSets,
        updatedOldestLastSeenIndex: resultUnseenIndex,
        updatedScrollToIndex: resultScrollToIndex,
      };
    }, [
      activeCall,
      callHistorySelector,
      callSelector,
      items,
      messages,
      midnightToday,
      oldestUnseenIndex,
      scrollToIndex,
    ]);

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
      isGroupTerminated={isGroupTerminated}
      isInFullScreenCall={isInFullScreenCall}
      isIncomingMessageRequest={isIncomingMessageRequest}
      isNearBottom={isNearBottom}
      isSomeoneTyping={isSomeoneTyping}
      items={collapseSets}
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
      oldestUnseenIndex={updatedOldestLastSeenIndex}
      renderContactSpoofingReviewDialog={renderContactSpoofingReviewDialog}
      renderHeroRow={renderHeroRow}
      renderItem={renderItem}
      renderTypingBubble={renderTypingBubble}
      scrollToIndex={updatedScrollToIndex}
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
