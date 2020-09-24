import React from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { Avatar } from '../Avatar';
import { ContactName } from './ContactName';
import { Message, MessageStatusType, Props as MessageProps } from './Message';
import { LocalizerType } from '../../types/Util';
import { ColorType } from '../../types/Colors';

interface Contact {
  status: MessageStatusType;

  title: string;
  phoneNumber?: string;
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

export interface Props {
  sentAt: number;
  receivedAt: number;

  message: MessageProps;
  errors: Array<Error>;
  contacts: Array<Contact>;

  i18n: LocalizerType;
}

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
      avatarPath,
      color,
      phoneNumber,
      name,
      profileName,
      title,
    } = contact;

    return (
      <Avatar
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={i18n}
        name={name}
        phoneNumber={phoneNumber}
        profileName={profileName}
        title={title}
        size={52}
      />
    );
  }

  public renderDeleteButton(): JSX.Element {
    const { i18n, message } = this.props;

    return (
      <div className="module-message-detail__delete-button-container">
        <button
          type="button"
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

  public renderContact(contact: Contact): JSX.Element {
    const { i18n } = this.props;
    const errors = contact.errors || [];

    const errorComponent = contact.isOutgoingKeyError ? (
      <div className="module-message-detail__contact__error-buttons">
        <button
          type="button"
          className="module-message-detail__contact__show-safety-number"
          onClick={contact.onShowSafetyNumber}
        >
          {i18n('showSafetyNumber')}
        </button>
        <button
          type="button"
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
    const { errors, message, receivedAt, sentAt, i18n } = this.props;

    return (
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      <div className="module-message-detail" tabIndex={0} ref={this.focusRef}>
        <div className="module-message-detail__message-container">
          <Message {...message} i18n={i18n} />
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
