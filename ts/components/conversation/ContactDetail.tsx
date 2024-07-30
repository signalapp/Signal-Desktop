// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ReadonlyDeep } from 'type-fest';

import type {
  EmbeddedContactType,
  Email,
  Phone,
  PostalAddress,
} from '../../types/EmbeddedContact';
import { AddressType, ContactFormType } from '../../types/EmbeddedContact';
import { missingCaseError } from '../../util/missingCaseError';

import {
  renderAvatar,
  renderContactShorthand,
  renderName,
} from './contactUtil';

import type { LocalizerType } from '../../types/Util';

export type Props = {
  contact: ReadonlyDeep<EmbeddedContactType>;
  hasSignalAccount: boolean;
  i18n: LocalizerType;
  onSendMessage: () => void;
};

function getLabelForEmail(method: Email, i18n: LocalizerType): string {
  switch (method.type) {
    case ContactFormType.CUSTOM:
      return method.label || i18n('icu:email');
    case ContactFormType.HOME:
      return i18n('icu:home');
    case ContactFormType.MOBILE:
      return i18n('icu:mobile');
    case ContactFormType.WORK:
      return i18n('icu:work');
    default:
      throw missingCaseError(method.type);
  }
}

function getLabelForPhone(method: Phone, i18n: LocalizerType): string {
  switch (method.type) {
    case ContactFormType.CUSTOM:
      return method.label || i18n('icu:phone');
    case ContactFormType.HOME:
      return i18n('icu:home');
    case ContactFormType.MOBILE:
      return i18n('icu:mobile');
    case ContactFormType.WORK:
      return i18n('icu:work');
    default:
      throw missingCaseError(method.type);
  }
}

function getLabelForAddress(
  address: PostalAddress,
  i18n: LocalizerType
): string {
  switch (address.type) {
    case AddressType.CUSTOM:
      return address.label || i18n('icu:address');
    case AddressType.HOME:
      return i18n('icu:home');
    case AddressType.WORK:
      return i18n('icu:work');
    default:
      throw missingCaseError(address.type);
  }
}

export function ContactDetail({
  contact,
  hasSignalAccount,
  i18n,
  onSendMessage,
}: Props): JSX.Element {
  // We don't want the overall click handler for this element to fire, so we stop
  //   propagation before handing control to the caller's callback.
  const onClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    onSendMessage();
  };

  const isIncoming = false;
  const module = 'contact-detail';

  return (
    <div className="module-contact-detail">
      <div className="module-contact-detail__avatar">
        {renderAvatar({ contact, i18n, size: 80 })}
      </div>
      {renderName({ contact, isIncoming, module })}
      {renderContactShorthand({ contact, isIncoming, module })}

      {hasSignalAccount && (
        <button
          type="button"
          className="module-contact-detail__send-message"
          onClick={onClick}
        >
          <div className="module-contact-detail__send-message__inner">
            <div className="module-contact-detail__send-message__bubble-icon" />
            {i18n('icu:sendMessageToContact')}
          </div>
        </button>
      )}

      {contact.number?.map((phone: Phone) => {
        return (
          <div
            key={phone.value}
            className="module-contact-detail__additional-contact"
          >
            <div className="module-contact-detail__additional-contact__type">
              {getLabelForPhone(phone, i18n)}
            </div>
            {phone.value}
          </div>
        );
      })}

      {contact.email?.map((email: Email) => {
        return (
          <div
            key={email.value}
            className="module-contact-detail__additional-contact"
          >
            <div className="module-contact-detail__additional-contact__type">
              {getLabelForEmail(email, i18n)}
            </div>
            {email.value}
          </div>
        );
      })}

      {contact.address?.map((address: PostalAddress, index: number) => {
        return (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="module-contact-detail__additional-contact"
          >
            <div className="module-contact-detail__additional-contact__type">
              {getLabelForAddress(address, i18n)}
            </div>
            {address.street && <div>{address.street}</div>}
            {address.pobox && (
              <div>
                {i18n('icu:poBox')} {address.pobox}
              </div>
            )}
            {address.neighborhood && <div>{address.neighborhood}</div>}
            {(address.city || address.region || address.postcode) && (
              <div>
                {address.city} {address.region} {address.postcode}
              </div>
            )}
            {address.country && <div>{address.country}</div>}
          </div>
        );
      })}
    </div>
  );
}
