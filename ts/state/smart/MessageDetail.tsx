// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ComponentProps } from 'react';
import { connect } from 'react-redux';

import { MessageDetail } from '../../components/conversation/MessageDetail';

import { mapDispatchToProps } from '../actions';
import { StateType } from '../reducer';
import { getIntl, getInteractionMode } from '../selectors/user';
import { renderAudioAttachment } from './renderAudioAttachment';
import { renderEmojiPicker } from './renderEmojiPicker';
import { getContactNameColorSelector } from '../selectors/conversations';

type MessageDetailProps = ComponentProps<typeof MessageDetail>;

export { Contact } from '../../components/conversation/MessageDetail';

export type OwnProps = Pick<
  MessageDetailProps,
  | 'clearSelectedMessage'
  | 'checkForAccount'
  | 'contacts'
  | 'deleteMessage'
  | 'deleteMessageForEveryone'
  | 'displayTapToViewMessage'
  | 'downloadAttachment'
  | 'doubleCheckMissingQuoteReference'
  | 'errors'
  | 'kickOffAttachmentDownload'
  | 'markAttachmentAsCorrupted'
  | 'message'
  | 'openConversation'
  | 'openLink'
  | 'reactToMessage'
  | 'receivedAt'
  | 'replyToMessage'
  | 'retrySend'
  | 'sendAnyway'
  | 'sentAt'
  | 'showContactDetail'
  | 'showContactModal'
  | 'showExpiredIncomingTapToViewToast'
  | 'showExpiredOutgoingTapToViewToast'
  | 'showForwardMessageModal'
  | 'showSafetyNumber'
  | 'showVisualAttachment'
>;

const mapStateToProps = (
  state: StateType,
  props: OwnProps
): MessageDetailProps => {
  const {
    contacts,
    errors,
    message,
    receivedAt,
    sentAt,

    sendAnyway,
    showSafetyNumber,

    checkForAccount,
    clearSelectedMessage,
    deleteMessage,
    deleteMessageForEveryone,
    displayTapToViewMessage,
    downloadAttachment,
    doubleCheckMissingQuoteReference,
    kickOffAttachmentDownload,
    markAttachmentAsCorrupted,
    openConversation,
    openLink,
    reactToMessage,
    replyToMessage,
    retrySend,
    showContactDetail,
    showContactModal,
    showExpiredIncomingTapToViewToast,
    showExpiredOutgoingTapToViewToast,
    showForwardMessageModal,
    showVisualAttachment,
  } = props;

  const contactNameColor =
    message.conversationType === 'group'
      ? getContactNameColorSelector(state)(
          message.conversationId,
          message.author.id
        )
      : undefined;

  return {
    contacts,
    contactNameColor,
    errors,
    message,
    receivedAt,
    sentAt,

    i18n: getIntl(state),
    interactionMode: getInteractionMode(state),

    sendAnyway,
    showSafetyNumber,

    checkForAccount,
    clearSelectedMessage,
    deleteMessage,
    deleteMessageForEveryone,
    displayTapToViewMessage,
    downloadAttachment,
    doubleCheckMissingQuoteReference,
    kickOffAttachmentDownload,
    markAttachmentAsCorrupted,
    openConversation,
    openLink,
    reactToMessage,
    renderAudioAttachment,
    renderEmojiPicker,
    replyToMessage,
    retrySend,
    showContactDetail,
    showContactModal,
    showExpiredIncomingTapToViewToast,
    showExpiredOutgoingTapToViewToast,
    showForwardMessageModal,
    showVisualAttachment,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartMessageDetail = smart(MessageDetail);
