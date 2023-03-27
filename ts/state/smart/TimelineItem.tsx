// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefObject } from 'react';
import React from 'react';
import { useSelector } from 'react-redux';

import { TimelineItem } from '../../components/conversation/TimelineItem';
import type { WidthBreakpoint } from '../../components/_util';
import { useProxySelector } from '../../hooks/useProxySelector';
import { useConversationsActions } from '../ducks/conversations';
import { useComposerActions } from '../ducks/composer';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useAccountsActions } from '../ducks/accounts';
import { useLightboxActions } from '../ducks/lightbox';
import { useStoriesActions } from '../ducks/stories';
import { useCallingActions } from '../ducks/calling';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getIntl, getInteractionMode, getTheme } from '../selectors/user';
import { getTargetedMessage } from '../selectors/conversations';
import { getTimelineItem } from '../selectors/timeline';
import {
  areMessagesInSameGroup,
  shouldCurrentMessageHideMetadata,
  UnreadIndicatorPlacement,
} from '../../util/timelineUtil';

import { SmartContactName } from './ContactName';
import { SmartUniversalTimerNotification } from './UniversalTimerNotification';
import { isSameDay } from '../../util/timestamp';
import { renderAudioAttachment } from './renderAudioAttachment';
import { renderEmojiPicker } from './renderEmojiPicker';
import { renderReactionPicker } from './renderReactionPicker';

type ExternalProps = {
  containerElementRef: RefObject<HTMLElement>;
  containerWidthBreakpoint: WidthBreakpoint;
  conversationId: string;
  isOldestTimelineItem: boolean;
  messageId: string;
  nextMessageId: undefined | string;
  previousMessageId: undefined | string;
  unreadIndicatorPlacement: undefined | UnreadIndicatorPlacement;
};

function renderContact(conversationId: string): JSX.Element {
  return <SmartContactName conversationId={conversationId} />;
}

function renderUniversalTimerNotification(): JSX.Element {
  return <SmartUniversalTimerNotification />;
}

export function SmartTimelineItem(props: ExternalProps): JSX.Element {
  const {
    containerElementRef,
    containerWidthBreakpoint,
    conversationId,
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
  const item = useProxySelector(getTimelineItem, messageId);
  const previousItem = useProxySelector(getTimelineItem, previousMessageId);
  const nextItem = useProxySelector(getTimelineItem, nextMessageId);

  const targetedMessage = useSelector(getTargetedMessage);
  const isTargeted = Boolean(
    targetedMessage && messageId === targetedMessage.id
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
    clearTargetedMessage: clearSelectedMessage,
    deleteMessages,
    deleteMessageForEveryone,
    doubleCheckMissingQuoteReference,
    kickOffAttachmentDownload,
    markAttachmentAsCorrupted,
    messageExpanded,
    openGiftBadge,
    pushPanelForConversation,
    retryDeleteForEveryone,
    retryMessageSend,
    saveAttachment,
    targetMessage,
    toggleSelectMessage,
    showConversation,
    showExpiredIncomingTapToViewToast,
    showExpiredOutgoingTapToViewToast,
    startConversation,
  } = useConversationsActions();

  const { reactToMessage, scrollToQuotedMessage, setQuoteByMessageId } =
    useComposerActions();

  const {
    showContactModal,
    showEditHistoryModal,
    toggleForwardMessagesModal,
    toggleSafetyNumberModal,
  } = useGlobalModalActions();

  const { checkForAccount } = useAccountsActions();

  const { showLightbox, showLightboxForViewOnceMedia } = useLightboxActions();

  const { viewStory } = useStoriesActions();

  const { returnToActiveCall, startCallingLobby } = useCallingActions();

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
      renderEmojiPicker={renderEmojiPicker}
      renderReactionPicker={renderReactionPicker}
      renderUniversalTimerNotification={renderUniversalTimerNotification}
      shouldCollapseAbove={shouldCollapseAbove}
      shouldCollapseBelow={shouldCollapseBelow}
      shouldHideMetadata={shouldHideMetadata}
      shouldRenderDateHeader={shouldRenderDateHeader}
      showEditHistoryModal={showEditHistoryModal}
      i18n={i18n}
      interactionMode={interactionMode}
      theme={theme}
      blockGroupLinkRequests={blockGroupLinkRequests}
      checkForAccount={checkForAccount}
      clearTargetedMessage={clearSelectedMessage}
      deleteMessages={deleteMessages}
      deleteMessageForEveryone={deleteMessageForEveryone}
      doubleCheckMissingQuoteReference={doubleCheckMissingQuoteReference}
      kickOffAttachmentDownload={kickOffAttachmentDownload}
      markAttachmentAsCorrupted={markAttachmentAsCorrupted}
      messageExpanded={messageExpanded}
      openGiftBadge={openGiftBadge}
      pushPanelForConversation={pushPanelForConversation}
      reactToMessage={reactToMessage}
      retryDeleteForEveryone={retryDeleteForEveryone}
      retryMessageSend={retryMessageSend}
      returnToActiveCall={returnToActiveCall}
      saveAttachment={saveAttachment}
      scrollToQuotedMessage={scrollToQuotedMessage}
      targetMessage={targetMessage}
      setQuoteByMessageId={setQuoteByMessageId}
      showContactModal={showContactModal}
      showConversation={showConversation}
      showExpiredIncomingTapToViewToast={showExpiredIncomingTapToViewToast}
      showExpiredOutgoingTapToViewToast={showExpiredOutgoingTapToViewToast}
      showLightbox={showLightbox}
      showLightboxForViewOnceMedia={showLightboxForViewOnceMedia}
      startCallingLobby={startCallingLobby}
      startConversation={startConversation}
      toggleForwardMessagesModal={toggleForwardMessagesModal}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      viewStory={viewStory}
      toggleSelectMessage={toggleSelectMessage}
    />
  );
}
