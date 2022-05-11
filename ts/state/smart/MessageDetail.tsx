// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import type { ExternalProps as MessageDetailProps } from '../../components/conversation/MessageDetail';
import { MessageDetail } from '../../components/conversation/MessageDetail';

import { mapDispatchToProps } from '../actions';
import type { StateType } from '../reducer';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getIntl, getInteractionMode, getTheme } from '../selectors/user';
import { renderAudioAttachment } from './renderAudioAttachment';
import { renderEmojiPicker } from './renderEmojiPicker';
import { renderReactionPicker } from './renderReactionPicker';
import { getContactNameColorSelector } from '../selectors/conversations';

export { Contact } from '../../components/conversation/MessageDetail';
export type OwnProps = Omit<
  MessageDetailProps,
  | 'getPreferredBadge'
  | 'i18n'
  | 'interactionMode'
  | 'renderAudioAttachment'
  | 'renderEmojiPicker'
  | 'renderReactionPicker'
  | 'theme'
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

    showSafetyNumber,

    displayTapToViewMessage,
    kickOffAttachmentDownload,
    markAttachmentAsCorrupted,
    markViewed,
    openConversation,
    openGiftBadge,
    openLink,
    reactToMessage,
    replyToMessage,
    retryDeleteForEveryone,
    retrySend,
    showContactDetail,
    showContactModal,
    showExpiredIncomingTapToViewToast,
    showExpiredOutgoingTapToViewToast,
    showForwardMessageModal,
    showVisualAttachment,
    startConversation,
  } = props;

  const contactNameColor =
    message.conversationType === 'group'
      ? getContactNameColorSelector(state)(
          message.conversationId,
          message.author.id
        )
      : undefined;

  const getPreferredBadge = getPreferredBadgeSelector(state);

  return {
    contacts,
    contactNameColor,
    errors,
    message,
    receivedAt,
    sentAt,

    getPreferredBadge,
    i18n: getIntl(state),
    interactionMode: getInteractionMode(state),
    theme: getTheme(state),

    showSafetyNumber,

    displayTapToViewMessage,
    kickOffAttachmentDownload,
    markAttachmentAsCorrupted,
    markViewed,
    openConversation,
    openGiftBadge,
    openLink,
    reactToMessage,
    renderAudioAttachment,
    renderEmojiPicker,
    renderReactionPicker,
    replyToMessage,
    retryDeleteForEveryone,
    retrySend,
    showContactDetail,
    showContactModal,
    showExpiredIncomingTapToViewToast,
    showExpiredOutgoingTapToViewToast,
    showForwardMessageModal,
    showVisualAttachment,
    startConversation,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartMessageDetail = smart(MessageDetail);
