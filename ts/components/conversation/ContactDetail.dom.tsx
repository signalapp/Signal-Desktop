// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import classNames from 'classnames';

import type { ReadonlyDeep } from 'type-fest';

import {
  AddressType,
  ContactFormType,
} from '../../types/EmbeddedContact.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import {
  renderAvatar,
  renderContactShorthand,
  renderName,
} from './contactUtil.dom.js';

import type {
  EmbeddedContactForUIType,
  Email,
  Phone,
  PostalAddress,
} from '../../types/EmbeddedContact.std.js';
import type { LocalizerType } from '../../types/Util.std.js';

export type Props = {
  cancelAttachmentDownload: (options: { messageId: string }) => void;
  contact: ReadonlyDeep<EmbeddedContactForUIType>;
  hasSignalAccount: boolean;
  i18n: LocalizerType;
  kickOffAttachmentDownload: (options: { messageId: string }) => void;
  messageId: string;
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
  cancelAttachmentDownload,
  contact,
  hasSignalAccount,
  i18n,
  kickOffAttachmentDownload,
  messageId,
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

  const maybeDownload = useCallback(() => {
    const attachment = contact.avatar?.avatar;
    if (!attachment) {
      return;
    }
    if (attachment.isPermanentlyUndownloadable) {
      return;
    }
    if (attachment.pending) {
      cancelAttachmentDownload({ messageId });
      return;
    }
    if (!attachment.path) {
      kickOffAttachmentDownload({ messageId });
    }
  }, [cancelAttachmentDownload, contact, kickOffAttachmentDownload, messageId]);
  const attachment = contact.avatar?.avatar;
  const isClickable =
    attachment &&
    !attachment.isPermanentlyUndownloadable &&
    (attachment.pending || !attachment.path);

  return (
    <div className="module-contact-detail">
      <button
        className={classNames(
          'module-contact-detail__avatar',
          isClickable ? 'module-contact-detail__avatar--clickable' : undefined
        )}
        type="button"
        onClick={(event: React.MouseEvent) => {
          event?.stopPropagation();
          event.preventDefault();
          maybeDownload();
        }}
        onKeyDown={(event: React.KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }
          event?.stopPropagation();
          event.preventDefault();
          maybeDownload();
        }}
      >
        {renderAvatar({ contact, direction: 'incoming', i18n, size: 80 })}
      </button>
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
