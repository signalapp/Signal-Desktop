// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import moment from 'moment';
import { noop } from 'lodash';

import { GlobalAudioProvider } from '../GlobalAudioContext';
import { Avatar } from '../Avatar';
import { ContactName } from './ContactName';
import {
  Message,
  MessageStatusType,
  Props as MessagePropsType,
  PropsData as MessagePropsDataType,
} from './Message';
import { LocalizerType } from '../../types/Util';
import { ConversationType } from '../../state/ducks/conversations';
import { assert } from '../../util/assert';
import { ContactNameColorType } from '../../types/Colors';

export type Contact = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'color'
  | 'id'
  | 'isMe'
  | 'name'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
  | 'unblurredAvatarPath'
> & {
  status: MessageStatusType | null;

  isOutgoingKeyError: boolean;
  isUnidentifiedDelivery: boolean;

  errors?: Array<Error>;
};

export type Props = {
  contacts: Array<Contact>;
  contactNameColor?: ContactNameColorType;
  errors: Array<Error>;
  message: MessagePropsDataType;
  receivedAt: number;
  sentAt: number;

  sendAnyway: (contactId: string, messageId: string) => unknown;
  showSafetyNumber: (contactId: string) => void;
  i18n: LocalizerType;
} & Pick<
  MessagePropsType,
  | 'checkForAccount'
  | 'clearSelectedMessage'
  | 'deleteMessage'
  | 'deleteMessageForEveryone'
  | 'displayTapToViewMessage'
  | 'downloadAttachment'
  | 'doubleCheckMissingQuoteReference'
  | 'interactionMode'
  | 'kickOffAttachmentDownload'
  | 'markAttachmentAsCorrupted'
  | 'openConversation'
  | 'openLink'
  | 'reactToMessage'
  | 'renderAudioAttachment'
  | 'renderEmojiPicker'
  | 'replyToMessage'
  | 'retrySend'
  | 'showContactDetail'
  | 'showContactModal'
  | 'showExpiredIncomingTapToViewToast'
  | 'showExpiredOutgoingTapToViewToast'
  | 'showForwardMessageModal'
  | 'showVisualAttachment'
>;

const _keyForError = (error: Error): string => {
  return `${error.name}-${error.message}`;
};

export class MessageDetail extends React.Component<Props> {
  private readonly focusRef = React.createRef<HTMLDivElement>();

  public componentDidMount(): void {
    // When this component is created, it's initially not part of the DOM, and then it's
    //   added off-screen and animated in. This ensures that the focus takes.
    setTimeout(() => {
      if (this.focusRef.current) {
        this.focusRef.current.focus();
      }
    });
  }

  public renderAvatar(contact: Contact): JSX.Element {
    const { i18n } = this.props;
    const {
      acceptedMessageRequest,
      avatarPath,
      color,
      isMe,
      name,
      phoneNumber,
      profileName,
      sharedGroupNames,
      title,
      unblurredAvatarPath,
    } = contact;

    return (
      <Avatar
        acceptedMessageRequest={acceptedMessageRequest}
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={i18n}
        isMe={isMe}
        name={name}
        phoneNumber={phoneNumber}
        profileName={profileName}
        title={title}
        sharedGroupNames={sharedGroupNames}
        size={52}
        unblurredAvatarPath={unblurredAvatarPath}
      />
    );
  }

  public renderDeleteButton(): JSX.Element {
    const { deleteMessage, i18n, message } = this.props;

    return (
      <div className="module-message-detail__delete-button-container">
        <button
          type="button"
          onClick={() => {
            deleteMessage(message.id);
          }}
          className="module-message-detail__delete-button"
        >
          {i18n('deleteThisMessage')}
        </button>
      </div>
    );
  }

  public renderContact(contact: Contact): JSX.Element {
    const { i18n, message, showSafetyNumber, sendAnyway } = this.props;
    const errors = contact.errors || [];

    const errorComponent = contact.isOutgoingKeyError ? (
      <div className="module-message-detail__contact__error-buttons">
        <button
          type="button"
          className="module-message-detail__contact__show-safety-number"
          onClick={() => showSafetyNumber(contact.id)}
        >
          {i18n('showSafetyNumber')}
        </button>
        <button
          type="button"
          className="module-message-detail__contact__send-anyway"
          onClick={() => sendAnyway(contact.id, message.id)}
        >
          {i18n('sendAnyway')}
        </button>
      </div>
    ) : null;
    const statusComponent = !contact.isOutgoingKeyError ? (
      <div
        className={classNames(
          'module-message-detail__contact__status-icon',
          contact.status
            ? `module-message-detail__contact__status-icon--${contact.status}`
            : undefined
        )}
      />
    ) : null;
    const unidentifiedDeliveryComponent = contact.isUnidentifiedDelivery ? (
      <div className="module-message-detail__contact__unidentified-delivery-icon" />
    ) : null;

    return (
      <div key={contact.phoneNumber} className="module-message-detail__contact">
        {this.renderAvatar(contact)}
        <div className="module-message-detail__contact__text">
          <div className="module-message-detail__contact__name">
            <ContactName
              phoneNumber={contact.phoneNumber}
              name={contact.name}
              profileName={contact.profileName}
              title={contact.title}
              i18n={i18n}
            />
          </div>
          {errors.map(error => (
            <div
              key={_keyForError(error)}
              className="module-message-detail__contact__error"
            >
              {error.message}
            </div>
          ))}
        </div>
        {errorComponent}
        {unidentifiedDeliveryComponent}
        {statusComponent}
      </div>
    );
  }

  public renderContacts(): JSX.Element | null {
    const { contacts } = this.props;

    if (!contacts || !contacts.length) {
      return null;
    }

    return (
      <div className="module-message-detail__contact-container">
        {contacts.map(contact => this.renderContact(contact))}
      </div>
    );
  }

  public render(): JSX.Element {
    const {
      errors,
      message,
      receivedAt,
      sentAt,

      checkForAccount,
      clearSelectedMessage,
      contactNameColor,
      deleteMessage,
      deleteMessageForEveryone,
      displayTapToViewMessage,
      downloadAttachment,
      doubleCheckMissingQuoteReference,
      i18n,
      interactionMode,
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
    } = this.props;

    return (
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      <div className="module-message-detail" tabIndex={0} ref={this.focusRef}>
        <div className="module-message-detail__message-container">
          <GlobalAudioProvider conversationId={message.conversationId}>
            <Message
              {...message}
              checkForAccount={checkForAccount}
              clearSelectedMessage={clearSelectedMessage}
              contactNameColor={contactNameColor}
              deleteMessage={deleteMessage}
              deleteMessageForEveryone={deleteMessageForEveryone}
              disableMenu
              disableScroll
              displayTapToViewMessage={displayTapToViewMessage}
              downloadAttachment={downloadAttachment}
              doubleCheckMissingQuoteReference={
                doubleCheckMissingQuoteReference
              }
              i18n={i18n}
              interactionMode={interactionMode}
              kickOffAttachmentDownload={kickOffAttachmentDownload}
              markAttachmentAsCorrupted={markAttachmentAsCorrupted}
              onHeightChange={noop}
              openConversation={openConversation}
              openLink={openLink}
              reactToMessage={reactToMessage}
              renderAudioAttachment={renderAudioAttachment}
              renderEmojiPicker={renderEmojiPicker}
              replyToMessage={replyToMessage}
              retrySend={retrySend}
              showForwardMessageModal={showForwardMessageModal}
              scrollToQuotedMessage={() => {
                assert(
                  false,
                  'scrollToQuotedMessage should never be called because scrolling is disabled'
                );
              }}
              showContactDetail={showContactDetail}
              showContactModal={showContactModal}
              showExpiredIncomingTapToViewToast={
                showExpiredIncomingTapToViewToast
              }
              showExpiredOutgoingTapToViewToast={
                showExpiredOutgoingTapToViewToast
              }
              showMessageDetail={() => {
                assert(
                  false,
                  "showMessageDetail should never be called because the menu is disabled (and we're already in the message detail!)"
                );
              }}
              showVisualAttachment={showVisualAttachment}
            />
          </GlobalAudioProvider>
        </div>
        <table className="module-message-detail__info">
          <tbody>
            {(errors || []).map(error => (
              <tr key={_keyForError(error)}>
                <td className="module-message-detail__label">
                  {i18n('error')}
                </td>
                <td>
                  {' '}
                  <span className="error-message">{error.message}</span>{' '}
                </td>
              </tr>
            ))}
            <tr>
              <td className="module-message-detail__label">{i18n('sent')}</td>
              <td>
                {moment(sentAt).format('LLLL')}{' '}
                <span className="module-message-detail__unix-timestamp">
                  ({sentAt})
                </span>
              </td>
            </tr>
            {receivedAt ? (
              <tr>
                <td className="module-message-detail__label">
                  {i18n('received')}
                </td>
                <td>
                  {moment(receivedAt).format('LLLL')}{' '}
                  <span className="module-message-detail__unix-timestamp">
                    ({receivedAt})
                  </span>
                </td>
              </tr>
            ) : null}
            <tr>
              <td className="module-message-detail__label">
                {message.direction === 'incoming' ? i18n('from') : i18n('to')}
              </td>
            </tr>
          </tbody>
        </table>
        {this.renderContacts()}
        {this.renderDeleteButton()}
      </div>
    );
  }
}
