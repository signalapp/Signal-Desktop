import React from 'react';

interface Props {
  contact: Contact;
  hasSignalAccount: boolean;
  i18n: (key: string, values?: Array<string>) => string;
  onSendMessage: () => void;
  onOpenContact: () => void;
}

interface Contact {
  name: Name;
  number?: Array<Phone>;
  email?: Array<Email>;
  address?: Array<PostalAddress>;
  avatar?: Avatar;
  organization?: string;
}

interface Name {
  givenName?: string;
  familyName?: string;
  prefix?: string;
  suffix?: string;
  middleName?: string;
  displayName: string;
}

enum ContactType {
  HOME = 1,
  MOBILE = 2,
  WORK = 3,
  CUSTOM = 4,
}

enum AddressType {
  HOME = 1,
  WORK = 2,
  CUSTOM = 3,
}

interface Phone {
  value: string;
  type: ContactType;
  label?: string;
}

interface Email {
  value: string;
  type: ContactType;
  label?: string;
}

interface PostalAddress {
  type: AddressType;
  label?: string;
  street?: string;
  pobox?: string;
  neighborhood?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
}

interface Avatar {
  avatar: Attachment;
  isProfile: boolean;
}

interface Attachment {
  path: string;
}

function getInitials(name: string): string {
  return name.trim()[0] || '#';
}

function getName(contact: Contact): string {
  const { name, organization } = contact;
  return (name && name.displayName) || organization || '';
}

export class EmbeddedContact extends React.Component<Props, {}> {
  public renderAvatar() {
    const { contact } = this.props;
    const { avatar } = contact;

    const path = avatar && avatar.avatar && avatar.avatar.path;
    if (!path) {
      const name = getName(contact);
      const initials = getInitials(name);
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

  public renderName() {
    const { contact } = this.props;

    return <div className="contact-name">{getName(contact)}</div>;
  }

  public renderContactShorthand() {
    const { contact } = this.props;
    const { number, email } = contact;
    const firstNumber = number && number[0] && number[0].value;
    const firstEmail = email && email[0] && email[0].value;

    return <div className="contact-method">{firstNumber || firstEmail}</div>;
  }

  public renderSendMessage() {
    const { hasSignalAccount, i18n, onSendMessage } = this.props;

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

  public render() {
    const { onOpenContact } = this.props;

    return (
      <div className="embedded-contact" onClick={onOpenContact}>
        <div className="first-line">
          {this.renderAvatar()}
          <div className="text-container">
            {this.renderName()}
            {this.renderContactShorthand()}
          </div>
        </div>
        {this.renderSendMessage()}
      </div>
    );
  }
}
