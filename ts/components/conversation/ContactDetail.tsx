import React from 'react';

import { missingCaseError } from '../../util/missingCaseError';

type Localizer = (key: string, values?: Array<string>) => string;

interface Props {
  contact: Contact;
  hasSignalAccount: boolean;
  i18n: Localizer;
  onSendMessage: () => void;
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

function getLabelForContactMethod(method: Phone | Email, i18n: Localizer) {
  switch (method.type) {
    case ContactType.CUSTOM:
      return method.label;
    case ContactType.HOME:
      return i18n('home');
    case ContactType.MOBILE:
      return i18n('mobile');
    case ContactType.WORK:
      return i18n('work');
    default:
      return missingCaseError(method.type);
  }
}

function getLabelForAddress(address: PostalAddress, i18n: Localizer) {
  switch (address.type) {
    case AddressType.CUSTOM:
      return address.label;
    case AddressType.HOME:
      return i18n('home');
    case AddressType.WORK:
      return i18n('work');
    default:
      return missingCaseError(address.type);
  }
}

function getInitials(name: string): string {
  return name.trim()[0] || '#';
}

function getName(contact: Contact): string {
  const { name, organization } = contact;
  return (name && name.displayName) || organization || '';
}

export class ContactDetail extends React.Component<Props, {}> {
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

  public renderAdditionalContact(
    items: Array<Phone | Email> | undefined,
    i18n: Localizer
  ) {
    if (!items || items.length === 0) {
      return;
    }

    return items.map((item: Phone | Email) => {
      return (
        <div key={item.value} className="additional-contact">
          <div className="type">{getLabelForContactMethod(item, i18n)}</div>
          {item.value}
        </div>
      );
    });
  }

  public renderAddressLineIfTruthy(value: string | undefined) {
    if (!value) {
      return;
    }

    return <div>{value}</div>;
  }

  public renderPOBox(poBox: string | undefined, i18n: Localizer) {
    if (!poBox) {
      return null;
    }

    return (
      <div>
        {i18n('poBox')} {poBox}
      </div>
    );
  }

  public renderAddressLineTwo(address: PostalAddress) {
    if (address.city || address.region || address.postcode) {
      return (
        <div>
          {address.city} {address.region} {address.postcode}
        </div>
      );
    }

    return null;
  }

  public renderAddresses(
    addresses: Array<PostalAddress> | undefined,
    i18n: Localizer
  ) {
    if (!addresses || addresses.length === 0) {
      return;
    }

    return addresses.map((address: PostalAddress, index: number) => {
      return (
        <div key={index} className="additional-contact">
          <div className="type">{getLabelForAddress(address, i18n)}</div>
          {this.renderAddressLineIfTruthy(address.street)}
          {this.renderPOBox(address.pobox, i18n)}
          {this.renderAddressLineIfTruthy(address.neighborhood)}
          {this.renderAddressLineTwo(address)}
          {this.renderAddressLineIfTruthy(address.country)}
        </div>
      );
    });
  }

  public render() {
    const { contact, i18n } = this.props;

    return (
      <div className="contact-detail">
        {this.renderAvatar()}
        {this.renderName()}
        {this.renderContactShorthand()}
        {this.renderSendMessage()}
        {this.renderAdditionalContact(contact.number, i18n)}
        {this.renderAdditionalContact(contact.email, i18n)}
        {this.renderAddresses(contact.address, i18n)}
      </div>
    );
  }
}
