// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefObject } from 'react';
import React, { useCallback, memo } from 'react';
import { useSelector } from 'react-redux';

import { TimelineItem } from '../../components/conversation/TimelineItem.dom.tsx';
import type { WidthBreakpoint } from '../../components/_util.std.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useComposerActions } from '../ducks/composer.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useAccountsActions } from '../ducks/accounts.preload.ts';
import { useLightboxActions } from '../ducks/lightbox.preload.ts';
import { useStoriesActions } from '../ducks/stories.preload.ts';
import { useCallingActions } from '../ducks/calling.preload.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import {
  getIntl,
  getInteractionMode,
  getTheme,
  getPlatform,
} from '../selectors/user.std.ts';
import {
  getSelectedMessageIds,
  getTargetedMessage,
  getTargetedMessageSource,
} from '../selectors/conversations.dom.ts';
import { getSharedGroupNames } from '../../util/sharedGroupNames.dom.ts';
import { startConversation } from '../../util/startConversation.dom.ts';
import { useTimelineItem } from '../selectors/timeline.preload.ts';
import {
  areMessagesInSameGroup,
  shouldCurrentMessageHideMetadata,
  UnreadIndicatorPlacement,
} from '../../util/timelineUtil.std.ts';

import { SmartContactName } from './ContactName.preload.tsx';
import { SmartUniversalTimerNotification } from './UniversalTimerNotification.dom.tsx';
import { isSameDay } from '../../util/timestamp.std.ts';
import { renderAudioAttachment } from './renderAudioAttachment.preload.tsx';
import { renderReactionPicker } from './renderReactionPicker.dom.tsx';
import type { MessageRequestState } from '../../components/conversation/MessageRequestActionsConfirmation.dom.tsx';
import { TargetedMessageSource } from '../ducks/conversationsEnums.std.ts';
import { MessageInteractivity } from '../../components/conversation/Message.dom.tsx';
import { useNavActions } from '../ducks/nav.std.ts';
import { DataReader } from '../../sql/Client.preload.ts';
import { isInternalFeaturesEnabled } from '../../util/isInternalFeaturesEnabled.dom.ts';
import type { CollapseSet } from '../../util/CollapseSet.std.ts';

export type RenderItemProps = Omit<SmartTimelineItemProps, 'renderItem'>;

export type SmartTimelineItemProps = {
  containerElementRef: RefObject<HTMLElement | null>;
  containerWidthBreakpoint: WidthBreakpoint;
  conversationId: string;
  interactivity: MessageInteractivity;
  isBlocked: boolean;
  isGroup: boolean;
  isOldestTimelineItem: boolean;
  item: CollapseSet;
  nextMessageId: undefined | string;
  previousMessageId: undefined | string;
  renderItem: (props: RenderItemProps) => React.JSX.Element;
  unreadIndicatorPlacement: undefined | UnreadIndicatorPlacement;
};

function renderContact(contactId: string): React.JSX.Element {
  return <SmartContactName contactId={contactId} />;
}

function renderUniversalTimerNotification(): React.JSX.Element {
  return <SmartUniversalTimerNotification />;
}
export const SmartTimelineItem = memo(function SmartTimelineItem(
  props: SmartTimelineItemProps
): React.JSX.Element {
  const {
    containerElementRef,
    containerWidthBreakpoint,
    conversationId,
    interactivity,
    isBlocked,
    isGroup,
    isOldestTimelineItem,
    item,
    nextMessageId,
    previousMessageId,
    renderItem,
    unreadIndicatorPlacement,
  } = props;

  const messageId = item.id;
  const i18n = useSelector(getIntl);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const interactionMode = useSelector(getInteractionMode);
  const theme = useSelector(getTheme);
  const platform = useSelector(getPlatform);
  const selectedMessageIds = useSelector(getSelectedMessageIds);

  const itemFromSelector = useTimelineItem(messageId, conversationId);
  const previousItem = useTimelineItem(previousMessageId, conversationId);
  const nextItem = useTimelineItem(nextMessageId, conversationId);
  const targetedMessage = useSelector(getTargetedMessage);
  const targetedMessageSource = useSelector(getTargetedMessageSource);
  const isTargeted = Boolean(
    interactivity !== MessageInteractivity.Hidden &&
    targetedMessage &&
    messageId === targetedMessage.id &&
    targetedMessageSource !== TargetedMessageSource.Reset
  );
  const isNextItemCallingNotification = nextItem?.type === 'callHistory';

  const shouldCollapseAbove =
    item.type === 'none' &&
    areMessagesInSameGroup(
      previousItem,
      unreadIndicatorPlacement === UnreadIndicatorPlacement.JustAbove,
      itemFromSelector
    );
  const shouldCollapseBelow =
    item.type === 'none' &&
    areMessagesInSameGroup(
      itemFromSelector,
      unreadIndicatorPlacement === UnreadIndicatorPlacement.JustBelow,
      nextItem
    );
  const shouldHideMetadata =
    item.type === 'none' &&
    shouldCurrentMessageHideMetadata(
      shouldCollapseBelow,
      itemFromSelector,
      nextItem
    );
  const shouldRenderDateHeader =
    isOldestTimelineItem ||
    Boolean(
      itemFromSelector &&
      previousItem &&
      // This comparison avoids strange header behavior for out-of-order messages.
      itemFromSelector.timestamp > previousItem.timestamp &&
      !isSameDay(previousItem.timestamp, itemFromSelector.timestamp)
    );

  const processedTimelineItem =
    item.type !== 'none' && itemFromSelector
      ? {
          type: 'collapseSet' as const,
          data: item,
          timestamp: itemFromSelector.timestamp,
        }
      : itemFromSelector;

  const isSelected =
    selectedMessageIds?.includes(messageId) ||
    (item.type !== 'none' &&
      item.messages.some(message => selectedMessageIds?.includes(message.id)));

  const {
    blockGroupLinkRequests,
    cancelAttachmentDownload,
    clearTargetedMessage: clearSelectedMessage,
    copyMessageText,
    doubleCheckMissingQuoteReference,
    kickOffAttachmentDownload,
    markAttachmentAsCorrupted,
    messageExpanded,
    onPinnedMessageRemove,
    openGiftBadge,
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
    targetMessage,
    toggleSelectMessage,
  } = useConversationsActions();

  const { pushPanelForConversation } = useNavActions();

  const {
    endPoll,
    reactToMessage,
    scrollToPinnedMessage,
    scrollToPollMessage,
    scrollToQuotedMessage,
    setQuoteByMessageId,
  } = useComposerActions();

  const {
    showContactModal,
    showEditHistoryModal,
    showPinMessageDialog,
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

  const handleDebugMessage = useCallback(async () => {
    if (!isInternalFeaturesEnabled()) {
      return;
    }
    const message = await DataReader.getMessageById(messageId);
    // oxlint-disable-next-line no-console
    console.debug(message);
    await window.navigator.clipboard.writeText(
      JSON.stringify(message, null, 2)
    );
  }, [messageId]);

  return (
    <TimelineItem
      item={processedTimelineItem}
      id={messageId}
      containerElementRef={containerElementRef}
      containerWidthBreakpoint={containerWidthBreakpoint}
      conversationId={conversationId}
      getPreferredBadge={getPreferredBadge}
      getSharedGroupNames={getSharedGroupNames}
      isNextItemCallingNotification={isNextItemCallingNotification}
      isTargeted={isTargeted}
      isSelectMode={selectedMessageIds != null}
      isSelected={isSelected}
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
      interactivity={interactivity}
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
      endPoll={endPoll}
      reactToMessage={reactToMessage}
      copyMessageText={copyMessageText}
      handleDebugMessage={handleDebugMessage}
      onOpenEditNicknameAndNoteModal={onOpenEditNicknameAndNoteModal}
      onOpenMessageRequestActionsConfirmation={
        onOpenMessageRequestActionsConfirmation
      }
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      showPinMessageDialog={showPinMessageDialog}
      onPinnedMessageRemove={onPinnedMessageRemove}
      scrollToPinnedMessage={scrollToPinnedMessage}
      retryDeleteForEveryone={retryDeleteForEveryone}
      retryMessageSend={retryMessageSend}
      sendPollVote={sendPollVote}
      renderItem={renderItem}
      returnToActiveCall={returnToActiveCall}
      saveAttachment={saveAttachment}
      saveAttachments={saveAttachments}
      scrollToPollMessage={scrollToPollMessage}
      scrollToQuotedMessage={scrollToQuotedMessage}
      targetMessage={targetMessage}
      targetedMessage={targetedMessage}
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
