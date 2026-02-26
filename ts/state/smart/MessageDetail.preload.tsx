// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useEffect } from 'react';
import { useSelector } from 'react-redux';

import type { Props as MessageDetailProps } from '../../components/conversation/MessageDetail.dom.js';
import { MessageDetail } from '../../components/conversation/MessageDetail.dom.js';
import { getContactNameColorSelector } from '../selectors/conversations.dom.js';
import {
  getIntl,
  getInteractionMode,
  getTheme,
  getPlatform,
} from '../selectors/user.std.js';
import { getMessageDetailsSelector } from '../selectors/message.preload.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import { renderAudioAttachment } from './renderAudioAttachment.preload.js';
import { startConversation } from '../../util/startConversation.dom.js';
import { useAccountsActions } from '../ducks/accounts.preload.js';
import { useComposerActions } from '../ducks/composer.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useLightboxActions } from '../ducks/lightbox.preload.js';
import { useStoriesActions } from '../ducks/stories.preload.js';
import { createLogger } from '../../logging/log.std.js';
import { useNavActions } from '../ducks/nav.std.js';
import { getPanelInformation } from '../selectors/nav.std.js';
import { PanelType } from '../../types/Panels.std.js';

export type { Contact } from '../../components/conversation/MessageDetail.dom.js';
export type OwnProps = Pick<
  MessageDetailProps,
  'contacts' | 'errors' | 'message' | 'receivedAt'
>;

const log = createLogger('SmartMessageDetail');

export const SmartMessageDetail = memo(function SmartMessageDetail({
  messageId,
}: {
  messageId: string | undefined;
}): React.JSX.Element | null {
  const getMessageDetails = useSelector(getMessageDetailsSelector);
  const getContactNameColor = useSelector(getContactNameColorSelector);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const i18n = useSelector(getIntl);
  const platform = useSelector(getPlatform);
  const interactionMode = useSelector(getInteractionMode);
  const theme = useSelector(getTheme);
  const { checkForAccount } = useAccountsActions();
  const { endPoll } = useComposerActions();
  const {
    cancelAttachmentDownload,
    clearTargetedMessage: clearSelectedMessage,
    doubleCheckMissingQuoteReference,
    kickOffAttachmentDownload,
    markAttachmentAsCorrupted,
    messageExpanded,
    openGiftBadge,
    retryMessageSend,
    sendPollVote,
    saveAttachment,
    saveAttachments,
    showAttachmentDownloadStillInProgressToast,
    showConversation,
    showExpiredIncomingTapToViewToast,
    showExpiredOutgoingTapToViewToast,
    showMediaNoLongerAvailableToast,
    showSpoiler,
  } = useConversationsActions();
  const { popPanelForConversation, pushPanelForConversation } = useNavActions();
  const {
    showContactModal,
    showEditHistoryModal,
    showTapToViewNotAvailableModal,
    toggleSafetyNumberModal,
  } = useGlobalModalActions();
  const { showLightbox, showLightboxForViewOnceMedia } = useLightboxActions();
  const { viewStory } = useStoriesActions();

  const messageDetails = messageId ? getMessageDetails(messageId) : undefined;

  // Only pop current panel if we are actually the current panel - when we're animating
  // out, we don't want to affect the current location.
  const currPanelType = useSelector(getPanelInformation)?.currPanel?.type;
  useEffect(() => {
    if (!messageDetails && currPanelType === PanelType.MessageDetails) {
      log.error(
        `MessageDetail: Current panel, and no details for message ${messageId}, popping panel.`
      );
      popPanelForConversation();
    }
  }, [currPanelType, messageDetails, messageId, popPanelForConversation]);

  if (!messageDetails) {
    log.error(
      `MessageDetail: No details found for message ${messageId}, rendering nothing.`
    );
    return null;
  }

  const { contacts, errors, message, receivedAt } = messageDetails;

  const contactNameColor =
    message.conversationType === 'group'
      ? getContactNameColor(message.conversationId, message.author.id)
      : undefined;

  return (
    <MessageDetail
      checkForAccount={checkForAccount}
      clearTargetedMessage={clearSelectedMessage}
      contactNameColor={contactNameColor}
      contacts={contacts}
      doubleCheckMissingQuoteReference={doubleCheckMissingQuoteReference}
      endPoll={endPoll}
      errors={errors}
      getPreferredBadge={getPreferredBadge}
      i18n={i18n}
      platform={platform}
      interactionMode={interactionMode}
      cancelAttachmentDownload={cancelAttachmentDownload}
      kickOffAttachmentDownload={kickOffAttachmentDownload}
      markAttachmentAsCorrupted={markAttachmentAsCorrupted}
      message={message}
      messageExpanded={messageExpanded}
      openGiftBadge={openGiftBadge}
      retryMessageSend={retryMessageSend}
      sendPollVote={sendPollVote}
      pushPanelForConversation={pushPanelForConversation}
      receivedAt={receivedAt}
      renderAudioAttachment={renderAudioAttachment}
      saveAttachment={saveAttachment}
      saveAttachments={saveAttachments}
      sentAt={message.timestamp}
      showContactModal={showContactModal}
      showConversation={showConversation}
      showEditHistoryModal={showEditHistoryModal}
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
      theme={theme}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      viewStory={viewStory}
    />
  );
});
