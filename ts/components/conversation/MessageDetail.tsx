import React from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { Avatar } from '../Avatar';
import { ContactName } from './ContactName';
import { Message, Props as MessageProps } from './Message';
import { ColorType, LocalizerType } from '../../types/Util';

interface Contact {
  status: string;
  phoneNumber: string;
  name?: string;
  profileName?: string;
  avatarPath?: string;
  color: ColorType;
  isOutgoingKeyError: boolean;
  isUnidentifiedDelivery: boolean;

  errors?: Array<Error>;

  onSendAnyway: () => void;
  onShowSafetyNumber: () => void;
}

interface Props {
  sentAt: number;
  receivedAt: number;

  message: MessageProps;
  errors: Array<Error>;
  contacts: Array<Contact>;

  i18n: LocalizerType;
}

export class MessageDetail extends React.Component<Props> {
  private readonly focusRef = React.createRef<HTMLDivElement>();

  public componentDidMount() {
    // When this component is created, it's initially not part of the DOM, and then it's
    //   added off-screen and animated in. This ensures that the focus takes.
    setTimeout(() => {
      if (this.focusRef.current) {
        this.focusRef.current.focus();
      }
    });
  }

  public renderAvatar(contact: Contact) {
    const { i18n } = this.props;
    const { avatarPath, color, phoneNumber, name, profileName } = contact;

    return (
      <Avatar
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={i18n}
        name={name}
        phoneNumber={phoneNumber}
        profileName={profileName}
        size={52}
      />
    );
  }

  public renderDeleteButton() {
    const { i18n, message } = this.props;

    return (
      <div className="module-message-detail__delete-button-container">
        <button
          onClick={() => {
            message.deleteMessage(message.id);
          }}
          className="module-message-detail__delete-button"
        >
          {i18n('deleteThisMessage')}
        </button>
      </div>
    );
  }

  public renderContact(contact: Contact) {
    const { i18n } = this.props;
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
    const { errors, message, receivedAt, sentAt, i18n } = this.props;

    return (
      <div className="module-message-detail" tabIndex={0} ref={this.focusRef}>
        <div className="module-message-detail__message-container">
          <Message i18n={i18n} {...message} />
        </div>
        {(errors || []).map((_error, index) => (
          <div className="error-message-label" key={index}>
            {i18n('error')}
          </div>
        ))}
        {(errors || []).map((error, index) => (
          <div className="error-message" key={index}>
            <span>{error.message}</span>{' '}
          </div>
        ))}
        <div className="module-message-detail__label-sent module-message-detail__label">
          {i18n('sent')}
        </div>
        <div className="module-message-detail__date-time-sent module-message-detail__date-time">
          {moment(sentAt).format('LLLL')}{' '}
          <span className="module-message-detail__unix-timestamp">
            ({sentAt})
          </span>
        </div>
        {receivedAt ? (
          <div className="module-message-detail__label-received module-message-detail__label">
            {i18n('received')}
          </div>
        ) : null}
        {receivedAt ? (
          <div className="module-message-detail__date-time-received module-message-detail__date-time">
            {moment(receivedAt).format('LLLL')}{' '}
            <span className="module-message-detail__unix-timestamp">
              ({receivedAt})
            </span>
          </div>
        ) : null}
        <div className="module-message-detail__label-contact module-message-detail__label">
          {message.direction === 'incoming' ? i18n('from') : i18n('to')}
        </div>
        {this.renderContacts()}
        {this.renderDeleteButton()}
      </div>
    );
  }
}
