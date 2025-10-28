// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefObject } from 'react';
import React, { useCallback, memo } from 'react';
import { useSelector } from 'react-redux';

import { TimelineItem } from '../../components/conversation/TimelineItem.dom.js';
import type { WidthBreakpoint } from '../../components/_util.std.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useComposerActions } from '../ducks/composer.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useAccountsActions } from '../ducks/accounts.preload.js';
import { useLightboxActions } from '../ducks/lightbox.preload.js';
import { useStoriesActions } from '../ducks/stories.preload.js';
import { useCallingActions } from '../ducks/calling.preload.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import {
  getIntl,
  getInteractionMode,
  getTheme,
  getPlatform,
} from '../selectors/user.std.js';
import {
  getTargetedMessage,
  getTargetedMessageSource,
} from '../selectors/conversations.dom.js';
import { useTimelineItem } from '../selectors/timeline.preload.js';
import {
  areMessagesInSameGroup,
  shouldCurrentMessageHideMetadata,
  UnreadIndicatorPlacement,
} from '../../util/timelineUtil.std.js';

import { SmartContactName } from './ContactName.preload.js';
import { SmartUniversalTimerNotification } from './UniversalTimerNotification.dom.js';
import { isSameDay } from '../../util/timestamp.std.js';
import { renderAudioAttachment } from './renderAudioAttachment.preload.js';
import { renderReactionPicker } from './renderReactionPicker.dom.js';
import type { MessageRequestState } from '../../components/conversation/MessageRequestActionsConfirmation.dom.js';
import { TargetedMessageSource } from '../ducks/conversationsEnums.std.js';

export type SmartTimelineItemProps = {
  containerElementRef: RefObject<HTMLElement>;
  containerWidthBreakpoint: WidthBreakpoint;
  conversationId: string;
  isBlocked: boolean;
  isGroup: boolean;
  isOldestTimelineItem: boolean;
  messageId: string;
  nextMessageId: undefined | string;
  previousMessageId: undefined | string;
  unreadIndicatorPlacement: undefined | UnreadIndicatorPlacement;
};

function renderContact(contactId: string): JSX.Element {
  return <SmartContactName contactId={contactId} />;
}

function renderUniversalTimerNotification(): JSX.Element {
  return <SmartUniversalTimerNotification />;
}
export const SmartTimelineItem = memo(function SmartTimelineItem(
  props: SmartTimelineItemProps
): JSX.Element {
  const {
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
  } = props;

  const i18n = useSelector(getIntl);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const interactionMode = useSelector(getInteractionMode);
  const theme = useSelector(getTheme);
  const platform = useSelector(getPlatform);

  const item = useTimelineItem(messageId, conversationId);
  const previousItem = useTimelineItem(previousMessageId, conversationId);
  const nextItem = useTimelineItem(nextMessageId, conversationId);
  const targetedMessage = useSelector(getTargetedMessage);
  const targetedMessageSource = useSelector(getTargetedMessageSource);
  const isTargeted = Boolean(
    targetedMessage &&
      messageId === targetedMessage.id &&
      targetedMessageSource !== TargetedMessageSource.Reset
  );
  const isNextItemCallingNotification = nextItem?.type === 'callHistory';

  const shouldCollapseAbove = areMessagesInSameGroup(
    previousItem,
    unreadIndicatorPlacement === UnreadIndicatorPlacement.JustAbove,
    item
  );
  const shouldCollapseBelow = areMessagesInSameGroup(
    item,
    unreadIndicatorPlacement === UnreadIndicatorPlacement.JustBelow,
    nextItem
  );
  const shouldHideMetadata = shouldCurrentMessageHideMetadata(
    shouldCollapseBelow,
    item,
    nextItem
  );
  const shouldRenderDateHeader =
    isOldestTimelineItem ||
    Boolean(
      item &&
        previousItem &&
        // This comparison avoids strange header behavior for out-of-order messages.
        item.timestamp > previousItem.timestamp &&
        !isSameDay(previousItem.timestamp, item.timestamp)
    );

  const {
    blockGroupLinkRequests,
    cancelAttachmentDownload,
    clearTargetedMessage: clearSelectedMessage,
    copyMessageText,
    doubleCheckMissingQuoteReference,
    kickOffAttachmentDownload,
    markAttachmentAsCorrupted,
    messageExpanded,
    openGiftBadge,
    pushPanelForConversation,
    retryDeleteForEveryone,
    retryMessageSend,
    saveAttachment,
    saveAttachments,
    sendPollVote,
    setMessageToEdit,
    showAttachmentDownloadStillInProgressToast,
    showConversation,
    showExpiredIncomingTapToViewToast,
    showExpiredOutgoingTapToViewToast,
    showMediaNoLongerAvailableToast,
    showSpoiler,
    startConversation,
    targetMessage,
    toggleSelectMessage,
  } = useConversationsActions();

  const { reactToMessage, scrollToQuotedMessage, setQuoteByMessageId } =
    useComposerActions();

  const {
    showContactModal,
    showEditHistoryModal,
    showTapToViewNotAvailableModal,
    toggleMessageRequestActionsConfirmation,
    toggleDeleteMessagesModal,
    toggleEditNicknameAndNoteModal,
    toggleForwardMessagesModal,
    toggleSafetyNumberModal,
  } = useGlobalModalActions();
  const { checkForAccount } = useAccountsActions();
  const { showLightbox, showLightboxForViewOnceMedia } = useLightboxActions();
  const { viewStory } = useStoriesActions();
  const {
    onOutgoingAudioCallInConversation,
    onOutgoingVideoCallInConversation,
    returnToActiveCall,
  } = useCallingActions();

  const onOpenEditNicknameAndNoteModal = useCallback(
    (contactId: string) => {
      toggleEditNicknameAndNoteModal({ conversationId: contactId });
    },
    [toggleEditNicknameAndNoteModal]
  );

  const onOpenMessageRequestActionsConfirmation = useCallback(
    (state: MessageRequestState) => {
      toggleMessageRequestActionsConfirmation({ conversationId, state });
    },
    [conversationId, toggleMessageRequestActionsConfirmation]
  );

  return (
    <TimelineItem
      item={item}
      id={messageId}
      containerElementRef={containerElementRef}
      containerWidthBreakpoint={containerWidthBreakpoint}
      conversationId={conversationId}
      getPreferredBadge={getPreferredBadge}
      isNextItemCallingNotification={isNextItemCallingNotification}
      isTargeted={isTargeted}
      renderAudioAttachment={renderAudioAttachment}
      renderContact={renderContact}
      renderReactionPicker={renderReactionPicker}
      renderUniversalTimerNotification={renderUniversalTimerNotification}
      shouldCollapseAbove={shouldCollapseAbove}
      shouldCollapseBelow={shouldCollapseBelow}
      shouldHideMetadata={shouldHideMetadata}
      shouldRenderDateHeader={shouldRenderDateHeader}
      showEditHistoryModal={showEditHistoryModal}
      i18n={i18n}
      interactionMode={interactionMode}
      isBlocked={isBlocked}
      isGroup={isGroup}
      theme={theme}
      platform={platform}
      blockGroupLinkRequests={blockGroupLinkRequests}
      checkForAccount={checkForAccount}
      clearTargetedMessage={clearSelectedMessage}
      doubleCheckMissingQuoteReference={doubleCheckMissingQuoteReference}
      cancelAttachmentDownload={cancelAttachmentDownload}
      kickOffAttachmentDownload={kickOffAttachmentDownload}
      markAttachmentAsCorrupted={markAttachmentAsCorrupted}
      messageExpanded={messageExpanded}
      openGiftBadge={openGiftBadge}
      pushPanelForConversation={pushPanelForConversation}
      reactToMessage={reactToMessage}
      copyMessageText={copyMessageText}
      onOpenEditNicknameAndNoteModal={onOpenEditNicknameAndNoteModal}
      onOpenMessageRequestActionsConfirmation={
        onOpenMessageRequestActionsConfirmation
      }
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      retryDeleteForEveryone={retryDeleteForEveryone}
      retryMessageSend={retryMessageSend}
      sendPollVote={sendPollVote}
      returnToActiveCall={returnToActiveCall}
      saveAttachment={saveAttachment}
      saveAttachments={saveAttachments}
      scrollToQuotedMessage={scrollToQuotedMessage}
      targetMessage={targetMessage}
      setQuoteByMessageId={setQuoteByMessageId}
      setMessageToEdit={setMessageToEdit}
      showContactModal={showContactModal}
      showConversation={showConversation}
      showAttachmentDownloadStillInProgressToast={
        showAttachmentDownloadStillInProgressToast
      }
      showExpiredIncomingTapToViewToast={showExpiredIncomingTapToViewToast}
      showExpiredOutgoingTapToViewToast={showExpiredOutgoingTapToViewToast}
      showLightbox={showLightbox}
      showLightboxForViewOnceMedia={showLightboxForViewOnceMedia}
      showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
      showSpoiler={showSpoiler}
      showTapToViewNotAvailableModal={showTapToViewNotAvailableModal}
      startConversation={startConversation}
      toggleDeleteMessagesModal={toggleDeleteMessagesModal}
      toggleForwardMessagesModal={toggleForwardMessagesModal}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      viewStory={viewStory}
      toggleSelectMessage={toggleSelectMessage}
    />
  );
});
