import React from 'react';

import {
  AddressType,
  Contact,
  ContactType,
  Email,
  Phone,
  PostalAddress,
} from '../../types/Contact';
import { missingCaseError } from '../../util/missingCaseError';

import {
  renderAvatar,
  renderContactShorthand,
  renderName,
  renderSendMessage,
} from './EmbeddedContact';

type Localizer = (key: string, values?: Array<string>) => string;

interface Props {
  contact: Contact;
  hasSignalAccount: boolean;
  i18n: Localizer;
  onSendMessage: () => void;
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

export class ContactDetail extends React.Component<Props, {}> {
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

  public renderAddressLine(value: string | undefined) {
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
          {this.renderAddressLine(address.street)}
          {this.renderPOBox(address.pobox, i18n)}
          {this.renderAddressLine(address.neighborhood)}
          {this.renderAddressLineTwo(address)}
          {this.renderAddressLine(address.country)}
        </div>
      );
    });
  }

  public render() {
    const { contact, hasSignalAccount, i18n, onSendMessage } = this.props;

    return (
      <div className="contact-detail">
        {renderAvatar(contact)}
        {renderName(contact)}
        {renderContactShorthand(contact)}
        {renderSendMessage({ hasSignalAccount, i18n, onSendMessage })}
        {this.renderAdditionalContact(contact.number, i18n)}
        {this.renderAdditionalContact(contact.email, i18n)}
        {this.renderAddresses(contact.address, i18n)}
      </div>
    );
  }
}
