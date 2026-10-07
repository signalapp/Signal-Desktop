// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, type JSX, type MouseEvent, type ReactNode } from 'react';

import type { ReadonlyDeep } from 'type-fest';

import {
  AddressType,
  ContactFormType,
  getDisplayName,
  getDisplayNickname,
} from '../../types/EmbeddedContact.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { canMessageSharedContact } from '../../util/sharedContact.std.ts';
import { format as formatPhoneNumber } from '../../types/PhoneNumber.std.ts';
import { ContactAvatar } from './contactUtil.dom.tsx';
import { InAnotherCallTooltip } from './InAnotherCallTooltip.dom.tsx';
import { AxoStackedButton } from '../../axo/AxoStackedButton.dom.tsx';
import { AxoList } from '../../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../../axo/items/AxoItem.dom.tsx';
import { AxoClickableItem } from '../../axo/items/AxoClickableItem.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';

import type {
  EmbeddedContactForUIType,
  Email,
  Phone,
  PostalAddress,
} from '../../types/EmbeddedContact.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';

export type Props = {
  cancelAttachmentDownload: (options: { messageId: string }) => void;
  contact: ReadonlyDeep<EmbeddedContactForUIType>;
  hasActiveCall: boolean;
  i18n: LocalizerType;
  kickOffAttachmentDownload: (options: { messageId: string }) => void;
  messageId: string;
  onAddToGroup: () => void;
  onSendMessage: () => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  ourRegionCode: string | undefined;
};

function getLabelForEmail(method: Email, i18n: LocalizerType): string {
  switch (method.type) {
    case ContactFormType.CUSTOM:
      return method.label || i18n('icu:email-v2');
    case ContactFormType.HOME:
      return i18n('icu:home-v2');
    case ContactFormType.MOBILE:
      return i18n('icu:mobile-v2');
    case ContactFormType.WORK:
      return i18n('icu:work-v2');
    default:
      throw missingCaseError(method.type);
  }
}

function getLabelForPhone(method: Phone, i18n: LocalizerType): string {
  switch (method.type) {
    case ContactFormType.CUSTOM:
      return method.label || i18n('icu:phone-v2');
    case ContactFormType.HOME:
      return i18n('icu:home-v2');
    case ContactFormType.MOBILE:
      return i18n('icu:mobile-v2');
    case ContactFormType.WORK:
      return i18n('icu:work-v2');
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
      return address.label || i18n('icu:address-v2');
    case AddressType.HOME:
      return i18n('icu:home-v2');
    case AddressType.WORK:
      return i18n('icu:work-v2');
    default:
      throw missingCaseError(address.type);
  }
}

function ContactDataItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}): JSX.Element {
  return (
    <AxoItem.Root>
      <AxoItem.Content>
        <AxoItem.Label>
          <div className={tw('type-body-small text-secondary')}>{label}</div>
          <div className={tw('type-body-large text-primary select-text')}>
            {value}
          </div>
        </AxoItem.Label>
      </AxoItem.Content>
    </AxoItem.Root>
  );
}

export function ContactDetail({
  cancelAttachmentDownload,
  contact,
  hasActiveCall,
  i18n,
  kickOffAttachmentDownload,
  messageId,
  onAddToGroup,
  onSendMessage,
  onStartAudioCall,
  onStartVideoCall,
  ourRegionCode,
}: Props): JSX.Element {
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
  const isAvatarClickable =
    attachment &&
    !attachment.isPermanentlyUndownloadable &&
    (attachment.pending || !attachment.path);

  const name = getDisplayName(contact);
  const nickname = getDisplayNickname(contact);

  const hasSignalAccount = canMessageSharedContact(contact);
  const hasFields = Boolean(
    contact.number?.length ||
    contact.email?.length ||
    contact.address?.length ||
    nickname ||
    contact.note
  );

  return (
    <div
      className={tw(
        'mx-auto flex w-full max-w-160 flex-col gap-6 px-4 pt-2 pb-8'
      )}
    >
      <div className={tw('flex flex-col items-center text-center')}>
        <ContactAvatar
          contact={contact}
          isIncoming
          label={name ?? null}
          onClick={
            isAvatarClickable
              ? (event: MouseEvent) => {
                  event.preventDefault();
                  maybeDownload();
                }
              : undefined
          }
          size={80}
        />
        <div className={tw('mt-3 type-title-large text-primary select-text')}>
          {name}
        </div>
        {Boolean(contact.organization) && (
          <div
            className={tw('mt-1 type-body-large text-secondary select-text')}
          >
            {contact.organization}
          </div>
        )}
      </div>

      {hasSignalAccount && (
        <AxoStackedButton.Row spacing="md">
          <AxoStackedButton.Root
            symbol="message"
            label={i18n('icu:ContactDetail__message')}
            onClick={onSendMessage}
          />
          <InAnotherCallTooltip i18n={i18n} inAnotherCall={hasActiveCall}>
            <AxoStackedButton.Root
              symbol="videocamera"
              label={i18n('icu:video')}
              discouraged={hasActiveCall}
              onClick={onStartVideoCall}
            />
          </InAnotherCallTooltip>
          <InAnotherCallTooltip i18n={i18n} inAnotherCall={hasActiveCall}>
            <AxoStackedButton.Root
              symbol="phone"
              label={i18n('icu:audio')}
              discouraged={hasActiveCall}
              onClick={onStartAudioCall}
            />
          </InAnotherCallTooltip>
        </AxoStackedButton.Row>
      )}

      <AxoList.Group>
        {hasSignalAccount && (
          <AxoList.Root>
            <AxoList.Body>
              <AxoItem.Group>
                <AxoClickableItem.Root
                  symbol="plus-circle"
                  label={i18n('icu:ContactDetail__add-to-group')}
                  onClick={onAddToGroup}
                />
              </AxoItem.Group>
            </AxoList.Body>
          </AxoList.Root>
        )}

        {hasFields && (
          <AxoList.Root>
            <AxoList.Body>
              <AxoItem.Group>
                {contact.number?.map((phone: Phone) => (
                  <ContactDataItem
                    key={phone.value}
                    label={getLabelForPhone(phone, i18n)}
                    value={formatPhoneNumber(phone.value, {
                      ourRegionCode,
                    })}
                  />
                ))}

                {contact.email?.map((email: Email) => (
                  <ContactDataItem
                    key={email.value}
                    label={getLabelForEmail(email, i18n)}
                    value={email.value}
                  />
                ))}
                {contact.address?.map((address: PostalAddress, idx: number) => (
                  <ContactDataItem
                    // oxlint-disable-next-line react/no-array-index-key
                    key={idx}
                    label={getLabelForAddress(address, i18n)}
                    value={
                      <>
                        {address.street && <div>{address.street}</div>}
                        {address.pobox && (
                          <div>
                            {i18n('icu:poBox')} {address.pobox}
                          </div>
                        )}
                        {address.neighborhood && (
                          <div>{address.neighborhood}</div>
                        )}
                        {(address.city ||
                          address.region ||
                          address.postcode) && (
                          <div>
                            {address.city} {address.region} {address.postcode}
                          </div>
                        )}
                        {address.country && <div>{address.country}</div>}
                      </>
                    }
                  />
                ))}

                {nickname ? (
                  <ContactDataItem
                    label={i18n('icu:ContactDetail__nickname')}
                    value={nickname}
                  />
                ) : null}
                {contact.note ? (
                  <ContactDataItem
                    label={i18n('icu:ContactDetail__note')}
                    value={
                      <span className={tw('whitespace-pre-wrap')}>
                        {contact.note}
                      </span>
                    }
                  />
                ) : null}
              </AxoItem.Group>
            </AxoList.Body>
          </AxoList.Root>
        )}
      </AxoList.Group>
    </div>
  );
}
