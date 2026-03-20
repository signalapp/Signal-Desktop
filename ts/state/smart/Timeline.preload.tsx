// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { isEqual, last } from 'lodash';

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
import type { CallStateType } from '../selectors/calling.std.js';
import { getMidnight } from '../../types/NotificationProfile.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';

import type { PropsType as SmartContactSpoofingReviewDialogPropsType } from './ContactSpoofingReviewDialog.preload.js';
import type { RenderItemProps } from './TimelineItem.preload.js';
import type { DurationInSeconds } from '../../util/durations/duration-in-seconds.std.js';
import type { MessageType } from '../ducks/conversations.preload.js';
import { SeenStatus } from '../../MessageSeenStatus.std.js';
import { getCallHistorySelector } from '../selectors/callHistory.std.js';
import type { CallHistorySelectorType } from '../selectors/callHistory.std.js';
import { CallMode } from '../../types/CallDisposition.std.js';
import { getCallIdFromEra } from '../../util/callDisposition.preload.js';

type ExternalProps = {
  id: string;
};

export type CollapsedMessage = {
  id: string;
  isUnseen: boolean;
  // A single group-v2-change message can have more than one change in it
  extraItems?: number;
};

export type CollapseSet =
  | {
      type: 'none';
      id: string;
      messages: undefined;
    }
  | {
      type: 'group-updates';
      id: string;
      messages: Array<CollapsedMessage>;
    }
  | {
      type: 'timer-changes';
      id: string;
      messages: Array<CollapsedMessage>;
      endingState: DurationInSeconds | undefined;
    }
  | {
      type: 'call-events';
      id: string;
      messages: Array<CollapsedMessage>;
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

function canCollapseForGroupSet(type: MessageType['type']): boolean {
  if (
    type === 'group-v2-change' ||
    type === 'keychange' ||
    type === 'profile-change'
  ) {
    return true;
  }

  return false;
}

function canCollapseForTimerSet(message: MessageType): boolean {
  if (message.type === 'timer-notification') {
    return true;
  }

  // Found some examples of messages with type = 'incoming' and an expirationTimerUpdate
  if (message.expirationTimerUpdate) {
    return true;
  }

  return false;
}

function canCollapseForCallSet(
  message: MessageType,
  options: {
    activeCall: CallStateType | undefined;
    callHistorySelector: CallHistorySelectorType;
    callSelector: (conversationId: string) => CallStateType | undefined;
  }
): boolean {
  if (message.type !== 'call-history') {
    return false;
  }

  const { callId, conversationId } = message;
  if (!callId) {
    return true;
  }

  const callHistory = options.callHistorySelector(callId);
  if (!callHistory) {
    return true;
  }

  // If a direct call is currently ongoing, we don't want to group it
  if (callHistory.mode === CallMode.Direct) {
    const isActiveCall = options.activeCall?.conversationId === conversationId;

    return !isActiveCall;
  }

  const conversationCall = options.callSelector(conversationId);
  if (!conversationCall) {
    return true;
  }

  strictAssert(
    conversationCall?.callMode === CallMode.Group,
    'canCollapseForCallSet: Call was expected to be a group call'
  );

  const conversationCallId =
    conversationCall?.peekInfo?.eraId != null &&
    getCallIdFromEra(conversationCall.peekInfo.eraId);

  const deviceCount = conversationCall?.peekInfo?.deviceCount ?? 0;

  // Don't group if current call in the converasation, or there are devices in the call
  if (
    callHistory.mode === CallMode.Group &&
    (callId === conversationCallId || deviceCount > 0)
  ) {
    return false;
  }

  return true;
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
  const { collapseSets, updatedOldestLastSeenIndex, updatedScrollToIndex } =
    React.useMemo(() => {
      let resultSets: Array<CollapseSet> = [];
      let resultUnseenIndex = oldestUnseenIndex;
      let resultScrollToIndex = scrollToIndex;

      const max = items.length;

      for (let i = 0; i < max; i += 1) {
        const previousId = items[i - 1];
        const lastCollapseSet = last(resultSets);

        const currentId = items[i];
        strictAssert(currentId, 'no item at index i');

        const currentMessage = messages[currentId];
        const previousMessage = previousId ? messages[previousId] : undefined;

        const changeLength = currentMessage?.groupV2Change?.details.length;
        const extraItems =
          changeLength && changeLength > 1 ? changeLength - 1 : undefined;

        const DEFAULT_SET: CollapseSet =
          currentMessage &&
          canCollapseForGroupSet(currentMessage.type) &&
          extraItems &&
          extraItems > 0
            ? {
                // A group-v2-change message with more than one inner change detail can be
                // a set all by itself!
                type: 'group-updates',
                id: currentId,
                messages: [
                  {
                    id: currentId,
                    isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
                    extraItems,
                  },
                ],
              }
            : {
                type: 'none' as const,
                id: currentId,
                messages: undefined,
              };

        // scrollToIndex needs to be translated to collapseSets.
        if (i === scrollToIndex) {
          resultScrollToIndex = resultSets.length;
        }

        // Start a new group if we just crossed the last seen indicator
        if (i === oldestUnseenIndex) {
          resultSets.push(DEFAULT_SET);
          resultUnseenIndex = resultSets.length - 1;
          continue;
        }

        // Start a new set if we just started looping
        if (!previousId) {
          resultSets.push(DEFAULT_SET);
          continue;
        }

        // Start a new set if we can't find message details
        if (!currentMessage || !previousMessage) {
          resultSets.push(DEFAULT_SET);
          continue;
        }

        // Start a new set if previous message and current message are on different days
        const currentDay = getMidnight(
          currentMessage.received_at_ms || currentMessage.timestamp
        );
        const previousDay = getMidnight(
          previousMessage.received_at_ms || previousMessage.timestamp
        );
        if (currentDay !== previousDay) {
          resultSets.push(DEFAULT_SET);
          continue;
        }

        strictAssert(
          lastCollapseSet,
          'collapseSets: expect lastCollapseSet to be defined'
        );

        // Add to current set if previous and current messages are both group updates
        if (
          canCollapseForGroupSet(currentMessage.type) &&
          canCollapseForGroupSet(previousMessage.type)
        ) {
          strictAssert(
            lastCollapseSet.type !== 'timer-changes' &&
              lastCollapseSet.type !== 'call-events',
            'Should never have two matching group items, but be in a timer or call set'
          );

          if (lastCollapseSet.type === 'group-updates') {
            lastCollapseSet.messages.push({
              id: currentId,
              isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
              extraItems,
            });
          } else if (lastCollapseSet.type === 'none') {
            resultSets.pop();
            resultSets.push({
              type: 'group-updates',
              id: previousId,
              messages: [
                {
                  id: previousId,
                  isUnseen: previousMessage.seenStatus === SeenStatus.Unseen,
                },
                {
                  id: currentId,
                  isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
                  extraItems,
                },
              ],
            });
          } else {
            throw missingCaseError(lastCollapseSet);
          }

          if (i === scrollToIndex) {
            resultScrollToIndex = resultSets.length - 1;
          }

          continue;
        }

        // Add to current set if previous and current messages are both timer updates
        if (
          canCollapseForTimerSet(currentMessage) &&
          canCollapseForTimerSet(previousMessage)
        ) {
          strictAssert(
            lastCollapseSet.type !== 'group-updates' &&
              lastCollapseSet.type !== 'call-events',
            'Should never have two matching timer items, but be in a group or call set'
          );

          if (lastCollapseSet.type === 'timer-changes') {
            lastCollapseSet.messages.push({
              id: currentId,
              isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
            });
            lastCollapseSet.endingState =
              currentMessage.expirationTimerUpdate?.expireTimer;
          } else if (lastCollapseSet.type === 'none') {
            resultSets.pop();
            resultSets.push({
              type: 'timer-changes',
              id: previousId,
              endingState: currentMessage.expirationTimerUpdate?.expireTimer,
              messages: [
                {
                  id: previousId,
                  isUnseen: previousMessage.seenStatus === SeenStatus.Unseen,
                },
                {
                  id: currentId,
                  isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
                },
              ],
            });
          } else {
            throw missingCaseError(lastCollapseSet);
          }

          if (i === scrollToIndex) {
            resultScrollToIndex = resultSets.length - 1;
          }

          continue;
        }

        // Add to current set if previous and current messages are both call events
        if (
          canCollapseForCallSet(currentMessage, {
            activeCall,
            callHistorySelector,
            callSelector,
          }) &&
          canCollapseForCallSet(previousMessage, {
            activeCall,
            callHistorySelector,
            callSelector,
          })
        ) {
          strictAssert(
            lastCollapseSet.type !== 'group-updates' &&
              lastCollapseSet.type !== 'timer-changes',
            'Should never have two matching timer items, but be in a group or timer set'
          );

          if (lastCollapseSet.type === 'call-events') {
            lastCollapseSet.messages.push({
              id: currentId,
              isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
            });
          } else if (lastCollapseSet.type === 'none') {
            resultSets.pop();
            resultSets.push({
              type: 'call-events',
              id: previousId,
              messages: [
                {
                  id: previousId,
                  isUnseen: previousMessage.seenStatus === SeenStatus.Unseen,
                },
                {
                  id: currentId,
                  isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
                },
              ],
            });
          } else {
            throw missingCaseError(lastCollapseSet);
          }

          if (i === scrollToIndex) {
            resultScrollToIndex = resultSets.length - 1;
          }

          continue;
        }

        // Finally, just add a new empty set if no situations above triggered
        resultSets.push(DEFAULT_SET);
      }

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
