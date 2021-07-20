// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactChild, ReactNode } from 'react';
import classNames from 'classnames';
import moment from 'moment';
import { noop } from 'lodash';

import { Avatar, AvatarSize } from '../Avatar';
import { ContactName } from './ContactName';
import {
  Message,
  Props as MessagePropsType,
  PropsData as MessagePropsDataType,
} from './Message';
import { LocalizerType } from '../../types/Util';
import { ConversationType } from '../../state/ducks/conversations';
import { assert } from '../../util/assert';
import { groupBy } from '../../util/mapUtil';
import { ContactNameColorType } from '../../types/Colors';
import { SendStatus } from '../../messages/MessageSendState';

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
  status?: SendStatus;

  isOutgoingKeyError: boolean;
  isUnidentifiedDelivery: boolean;

  errors?: Array<Error>;
};

export type Props = {
  // An undefined status means they were the sender and it's an incoming message. If
  //   `undefined` is a status, there should be no other items in the array; if there are
  //   any defined statuses, `undefined` shouldn't be present.
  contacts: ReadonlyArray<Contact>;

  contactNameColor?: ContactNameColorType;
  errors: Array<Error>;
  message: Omit<MessagePropsDataType, 'renderingContext'>;
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

const contactSortCollator = new Intl.Collator();

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
        size={AvatarSize.THIRTY_SIX}
        unblurredAvatarPath={unblurredAvatarPath}
      />
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
    const unidentifiedDeliveryComponent = contact.isUnidentifiedDelivery ? (
      <div className="module-message-detail__contact__unidentified-delivery-icon" />
    ) : null;

    return (
      <div key={contact.id} className="module-message-detail__contact">
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
      </div>
    );
  }

  private renderContactGroup(
    sendStatus: undefined | SendStatus,
    contacts: undefined | ReadonlyArray<Contact>
  ): ReactNode {
    const { i18n } = this.props;
    if (!contacts || !contacts.length) {
      return null;
    }

    const i18nKey =
      sendStatus === undefined ? 'from' : `MessageDetailsHeader--${sendStatus}`;

    const sortedContacts = [...contacts].sort((a, b) =>
      contactSortCollator.compare(a.title, b.title)
    );

    return (
      <div key={i18nKey} className="module-message-detail__contact-group">
        <div
          className={classNames(
            'module-message-detail__contact-group__header',
            sendStatus &&
              `module-message-detail__contact-group__header--${sendStatus}`
          )}
        >
          {i18n(i18nKey)}
        </div>
        {sortedContacts.map(contact => this.renderContact(contact))}
      </div>
    );
  }

  private renderContacts(): ReactChild {
    // This assumes that the list either contains one sender (a status of `undefined`) or
    //   1+ contacts with `SendStatus`es, but it doesn't check that assumption.
    const { contacts } = this.props;

    const contactsBySendStatus = groupBy(contacts, contact => contact.status);

    return (
      <div className="module-message-detail__contact-container">
        {[
          undefined,
          SendStatus.Failed,
          SendStatus.Viewed,
          SendStatus.Read,
          SendStatus.Delivered,
          SendStatus.Sent,
          SendStatus.Pending,
        ].map(sendStatus =>
          this.renderContactGroup(
            sendStatus,
            contactsBySendStatus.get(sendStatus)
          )
        )}
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
          <Message
            {...message}
            renderingContext="conversation/MessageDetail"
            checkForAccount={checkForAccount}
            clearSelectedMessage={clearSelectedMessage}
            contactNameColor={contactNameColor}
            deleteMessage={deleteMessage}
            deleteMessageForEveryone={deleteMessageForEveryone}
            disableMenu
            disableScroll
            displayTapToViewMessage={displayTapToViewMessage}
            downloadAttachment={downloadAttachment}
            doubleCheckMissingQuoteReference={doubleCheckMissingQuoteReference}
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
          </tbody>
        </table>
        {this.renderContacts()}
      </div>
    );
  }
}
