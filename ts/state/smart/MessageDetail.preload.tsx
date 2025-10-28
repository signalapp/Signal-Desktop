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
import { getMessageDetails } from '../selectors/message.preload.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import { renderAudioAttachment } from './renderAudioAttachment.preload.js';
import { useAccountsActions } from '../ducks/accounts.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useLightboxActions } from '../ducks/lightbox.preload.js';
import { useStoriesActions } from '../ducks/stories.preload.js';

export type { Contact } from '../../components/conversation/MessageDetail.dom.js';
export type OwnProps = Pick<
  MessageDetailProps,
  'contacts' | 'errors' | 'message' | 'receivedAt'
>;

export const SmartMessageDetail = memo(
  function SmartMessageDetail(): JSX.Element | null {
    const getContactNameColor = useSelector(getContactNameColorSelector);
    const getPreferredBadge = useSelector(getPreferredBadgeSelector);
    const i18n = useSelector(getIntl);
    const platform = useSelector(getPlatform);
    const interactionMode = useSelector(getInteractionMode);
    const messageDetails = useSelector(getMessageDetails);
    const theme = useSelector(getTheme);
    const { checkForAccount } = useAccountsActions();
    const {
      cancelAttachmentDownload,
      clearTargetedMessage: clearSelectedMessage,
      doubleCheckMissingQuoteReference,
      kickOffAttachmentDownload,
      markAttachmentAsCorrupted,
      messageExpanded,
      openGiftBadge,
      popPanelForConversation,
      pushPanelForConversation,
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
      startConversation,
    } = useConversationsActions();
    const {
      showContactModal,
      showEditHistoryModal,
      showTapToViewNotAvailableModal,
      toggleSafetyNumberModal,
    } = useGlobalModalActions();
    const { showLightbox, showLightboxForViewOnceMedia } = useLightboxActions();
    const { viewStory } = useStoriesActions();

    useEffect(() => {
      if (!messageDetails) {
        popPanelForConversation();
      }
    }, [messageDetails, popPanelForConversation]);

    if (!messageDetails) {
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
  }
);
