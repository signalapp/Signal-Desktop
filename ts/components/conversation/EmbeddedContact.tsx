import React from 'react';
import { Contact, getName } from '../../types/Contact';

interface Props {
  contact: Contact;
  hasSignalAccount: boolean;
  i18n: (key: string, values?: Array<string>) => string;
  onSendMessage: () => void;
  onOpenContact: () => void;
}

export class EmbeddedContact extends React.Component<Props, {}> {
  public render() {
    const {
      contact,
      hasSignalAccount,
      i18n,
      onOpenContact,
      onSendMessage,
    } = this.props;

    return (
      <div className="embedded-contact" onClick={onOpenContact}>
        <div className="first-line">
          {renderAvatar(contact)}
          <div className="text-container">
            {renderName(contact)}
            {renderContactShorthand(contact)}
          </div>
        </div>
        {renderSendMessage({ hasSignalAccount, i18n, onSendMessage })}
      </div>
    );
  }
}

// Note: putting these below the main component so style guide picks up EmbeddedContact

function getInitials(name: string): string {
  return name.trim()[0] || '#';
}

export function renderAvatar(contact: Contact) {
  const { avatar } = contact;

  const path = avatar && avatar.avatar && avatar.avatar.path;
  if (!path) {
    const name = getName(contact);
    const initials = getInitials(name || '');
    return (
      <div className="image-container">
        <div className="default-avatar">{initials}</div>
      </div>
    );
  }

  return (
    <div className="image-container">
      <img src={path} />
    </div>
  );
}

export function renderName(contact: Contact) {
  return <div className="contact-name">{getName(contact)}</div>;
}

export function renderContactShorthand(contact: Contact) {
  const { number: phoneNumber, email } = contact;
  const firstNumber = phoneNumber && phoneNumber[0] && phoneNumber[0].value;
  const firstEmail = email && email[0] && email[0].value;

  return <div className="contact-method">{firstNumber || firstEmail}</div>;
}

export function renderSendMessage(props: {
  hasSignalAccount: boolean;
  i18n: (key: string, values?: Array<string>) => string;
  onSendMessage: () => void;
}) {
  const { hasSignalAccount, i18n, onSendMessage } = props;

  if (!hasSignalAccount) {
    return null;
  }

  // We don't want the overall click handler for this element to fire, so we stop
  //   propagation before handing control to the caller's callback.
  const onClick = (e: React.MouseEvent<{}>): void => {
    e.stopPropagation();
    onSendMessage();
  };

  return (
    <div className="send-message" onClick={onClick}>
      <button className="inner">
        <div className="icon bubble-icon" />
        {i18n('sendMessageToContact')}
      </button>
    </div>
  );
}
