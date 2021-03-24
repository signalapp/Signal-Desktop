// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ComponentProps } from 'react';
import { connect } from 'react-redux';

import {
  MessageDetail,
  Contact,
} from '../../components/conversation/MessageDetail';
import { PropsData as MessagePropsDataType } from '../../components/conversation/Message';
import { mapDispatchToProps } from '../actions';

import { StateType } from '../reducer';
import { getIntl, getInteractionMode } from '../selectors/user';
import { renderAudioAttachment } from './renderAudioAttachment';
import { renderEmojiPicker } from './renderEmojiPicker';

type MessageDetailProps = ComponentProps<typeof MessageDetail>;

export type OwnProps = {
  contacts: Array<Contact>;
  errors: Array<Error>;
  message: MessagePropsDataType;
  receivedAt: number;
  sentAt: number;
} & Pick<
  MessageDetailProps,
  | 'clearSelectedMessage'
  | 'deleteMessage'
  | 'deleteMessageForEveryone'
  | 'displayTapToViewMessage'
  | 'downloadAttachment'
  | 'kickOffAttachmentDownload'
  | 'markAttachmentAsCorrupted'
  | 'openConversation'
  | 'openLink'
  | 'reactToMessage'
  | 'replyToMessage'
  | 'retrySend'
  | 'showContactDetail'
  | 'showContactModal'
  | 'showExpiredIncomingTapToViewToast'
  | 'showExpiredOutgoingTapToViewToast'
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

    clearSelectedMessage,
    deleteMessage,
    deleteMessageForEveryone,
    displayTapToViewMessage,
    downloadAttachment,
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
    showVisualAttachment,
  } = props;

  return {
    contacts,
    errors,
    message,
    receivedAt,
    sentAt,

    i18n: getIntl(state),
    interactionMode: getInteractionMode(state),

    clearSelectedMessage,
    deleteMessage,
    deleteMessageForEveryone,
    displayTapToViewMessage,
    downloadAttachment,
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
    showVisualAttachment,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartMessageDetail = smart(MessageDetail);
