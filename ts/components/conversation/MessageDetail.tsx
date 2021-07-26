import React from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { Avatar, AvatarSize } from '../Avatar';
import { ContactName } from './ContactName';
import { Message } from './Message';
import { MessageRenderingProps } from '../../models/messageType';
import { deleteMessagesById } from '../../interactions/conversationInteractions';
import { useSelector } from 'react-redux';
import { ContactPropsMessageDetail } from '../../state/ducks/conversations';
import { getMessageDetailsViewProps } from '../../state/selectors/conversations';

const AvatarItem = (props: { contact: ContactPropsMessageDetail }) => {
  const { avatarPath, phoneNumber, name, profileName } = props.contact;
  const userName = name || profileName || phoneNumber;

  return (
    <Avatar avatarPath={avatarPath} name={userName} size={AvatarSize.S} pubkey={phoneNumber} />
  );
};

const DeleteButtonItem = (props: { id: string; convoId: string; isDeletable: boolean }) => {
  const { i18n } = window;

  return props.isDeletable ? (
    <div className="module-message-detail__delete-button-container">
      <button
        onClick={() => {
          void deleteMessagesById([props.id], props.convoId, true);
        }}
        className="module-message-detail__delete-button"
      >
        {i18n('deleteThisMessage')}
      </button>
    </div>
  ) : null;
};

const ContactsItem = (props: { contacts: Array<ContactPropsMessageDetail> }) => {
  const { contacts } = props;

  if (!contacts || !contacts.length) {
    return null;
  }

  return (
    <div className="module-message-detail__contact-container">
      {contacts.map(contact => (
        <ContactItem key={contact.phoneNumber} contact={contact} />
      ))}
    </div>
  );
};

const ContactItem = (props: { contact: ContactPropsMessageDetail }) => {
  const { contact } = props;
  const errors = contact.errors || [];

  const statusComponent = !contact.isOutgoingKeyError ? (
    <div
      className={classNames(
        'module-message-detail__contact__status-icon',
        `module-message-detail__contact__status-icon--${contact.status}`
      )}
    />
  ) : null;

  return (
    <div key={contact.phoneNumber} className="module-message-detail__contact">
      <AvatarItem contact={contact} />
      <div className="module-message-detail__contact__text">
        <div className="module-message-detail__contact__name">
          <ContactName
            phoneNumber={contact.phoneNumber}
            name={contact.name}
            profileName={contact.profileName}
            shouldShowPubkey={true}
          />
        </div>
        {errors.map((error, index) => (
          <div key={index} className="module-message-detail__contact__error">
            {error.message}
          </div>
        ))}
      </div>
      {statusComponent}
    </div>
  );
};

export const MessageDetail = () => {
  const { i18n } = window;

  const messageDetailProps = useSelector(getMessageDetailsViewProps);

  if (!messageDetailProps) {
    return null;
  }

  const { errors, message, receivedAt, sentAt } = messageDetailProps;

  return (
    <div className="message-detail-wrapper">
      <div className="module-message-detail">
        <div className="module-message-detail__message-container">
          <Message {...message} firstMessageOfSeries={true} multiSelectMode={false} />
        </div>
        <table className="module-message-detail__info">
          <tbody>
            {(errors || []).map((error, index) => (
              <tr key={index}>
                <td className="module-message-detail__label">{i18n('error')}</td>
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
                <span className="module-message-detail__unix-timestamp">({sentAt})</span>
              </td>
            </tr>
            {receivedAt ? (
              <tr>
                <td className="module-message-detail__label">{i18n('received')}</td>
                <td>
                  {moment(receivedAt).format('LLLL')}{' '}
                  <span className="module-message-detail__unix-timestamp">({receivedAt})</span>
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
        <ContactsItem contacts={messageDetailProps.contacts} />
        <DeleteButtonItem
          convoId={messageDetailProps.message.convoId}
          id={messageDetailProps.message.id}
          isDeletable={messageDetailProps.message.isDeletable}
        />
      </div>
    </div>
  );
};
