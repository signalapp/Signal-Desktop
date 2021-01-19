import React from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { Avatar } from '../Avatar';
import { ContactName } from './ContactName';
import { Message } from './Message';
import { MessageRegularProps } from '../../../js/models/messages';

interface Contact {
  status: string;
  phoneNumber: string;
  name?: string;
  profileName?: string;
  avatarPath?: string;
  color: string;
  isOutgoingKeyError: boolean;
  isUnidentifiedDelivery: boolean;

  errors?: Array<Error>;

  onSendAnyway: () => void;
  onShowSafetyNumber: () => void;
}

interface Props {
  sentAt: number;
  receivedAt: number;

  message: MessageRegularProps;
  errors: Array<Error>;
  contacts: Array<Contact>;

  onDeleteMessage: (messageId: string) => void;
}

export class MessageDetail extends React.Component<Props> {
  public renderAvatar(contact: Contact) {
    const { avatarPath, phoneNumber, name, profileName } = contact;
    const userName = name || profileName || phoneNumber;

    return (
      <Avatar
        avatarPath={avatarPath}
        name={userName}
        size={36}
        pubkey={phoneNumber}
      />
    );
  }

  public renderDeleteButton() {
    const { i18n } = window;

    const { message } = this.props;

    return message.isDeletable ? (
      <div className="module-message-detail__delete-button-container">
        <button
          onClick={() => {
            this.props.onDeleteMessage(message.id);
          }}
          className="module-message-detail__delete-button"
        >
          {i18n('deleteThisMessage')}
        </button>
      </div>
    ) : null;
  }

  public renderContact(contact: Contact) {
    const { i18n } = window;
    const errors = contact.errors || [];

    const errorComponent = contact.isOutgoingKeyError ? (
      <div className="module-message-detail__contact__error-buttons">
        <button
          className="module-message-detail__contact__show-safety-number"
          onClick={contact.onShowSafetyNumber}
        >
          {i18n('showSafetyNumber')}
        </button>
        <button
          className="module-message-detail__contact__send-anyway"
          onClick={contact.onSendAnyway}
        >
          {i18n('sendAnyway')}
        </button>
      </div>
    ) : null;
    const statusComponent = !contact.isOutgoingKeyError ? (
      <div
        className={classNames(
          'module-message-detail__contact__status-icon',
          `module-message-detail__contact__status-icon--${contact.status}`
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
              i18n={i18n}
              shouldShowPubkey={true}
            />
          </div>
          {errors.map((error, index) => (
            <div key={index} className="module-message-detail__contact__error">
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

  public renderContacts() {
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

  public render() {
    const { i18n } = window;

    const { errors, message, receivedAt, sentAt } = this.props;

    return (
      <div className="message-detail-wrapper">
        <div className="module-message-detail">
          <div className="module-message-detail__message-container">
            <Message {...message} />
          </div>
          <table className="module-message-detail__info">
            <tbody>
              {(errors || []).map((error, index) => (
                <tr key={index}>
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
      </div>
    );
  }
}
