// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { noop } from 'lodash';

import { Avatar } from './Avatar';
import type { ActionSpec } from './ConfirmationDialog';
import { ConfirmationDialog } from './ConfirmationDialog';
import { InContactsIcon } from './InContactsIcon';
import { Modal } from './Modal';

import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { LocalizerType, ThemeType } from '../types/Util';
import { isInSystemContacts } from '../util/isInSystemContacts';

export enum SafetyNumberChangeSource {
  Calling = 'Calling',
  MessageSend = 'MessageSend',
  Story = 'Story',
}

export type SafetyNumberProps = {
  contactID: string;
  onClose: () => void;
};

export type Props = {
  readonly confirmText?: string;
  readonly contacts: Array<ConversationType>;
  readonly getPreferredBadge: PreferredBadgeSelectorType;
  readonly i18n: LocalizerType;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly renderSafetyNumber: (props: SafetyNumberProps) => JSX.Element;
  readonly theme: ThemeType;
};

export const SafetyNumberChangeDialog = ({
  confirmText,
  contacts,
  getPreferredBadge,
  i18n,
  onCancel,
  onConfirm,
  renderSafetyNumber,
  theme,
}: Props): JSX.Element => {
  const [isReviewing, setIsReviewing] = React.useState<boolean>(
    contacts.length <= 5
  );
  const [selectedContact, setSelectedContact] = React.useState<
    ConversationType | undefined
  >(undefined);
  const cancelButtonRef = React.createRef<HTMLButtonElement>();

  React.useEffect(() => {
    if (cancelButtonRef && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [cancelButtonRef, contacts]);

  const onClose = selectedContact
    ? () => {
        setSelectedContact(undefined);
      }
    : onCancel;

  if (selectedContact) {
    return (
      <Modal
        modalName="SafetyNumberChangeDialog"
        hasXButton
        i18n={i18n}
        onClose={onClose}
      >
        {renderSafetyNumber({ contactID: selectedContact.id, onClose })}
      </Modal>
    );
  }

  const allVerified = contacts.every(contact => contact.isVerified);
  const actions: Array<ActionSpec> = [
    {
      action: onConfirm,
      text:
        confirmText ||
        (allVerified
          ? i18n('safetyNumberChangeDialog_send')
          : i18n('sendAnyway')),
      style: 'affirmative',
    },
  ];

  if (isReviewing) {
    return (
      <ConfirmationDialog
        key="SafetyNumberChangeDialog.reviewing"
        dialogName="SafetyNumberChangeDialog.reviewing"
        actions={actions}
        hasXButton
        i18n={i18n}
        moduleClassName="module-SafetyNumberChangeDialog__confirm-dialog"
        noMouseClose
        noDefaultCancelButton={!isReviewing}
        onCancel={onClose}
        onClose={noop}
      >
        <div className="module-SafetyNumberChangeDialog__shield-icon" />
        <div className="module-SafetyNumberChangeDialog__title">
          {i18n('safetyNumberChanges')}
        </div>
        <div className="module-SafetyNumberChangeDialog__message">
          {i18n('safetyNumberChangeDialog__message')}
        </div>
        <ul className="module-SafetyNumberChangeDialog__contacts">
          {contacts.map((contact: ConversationType) => {
            const shouldShowNumber = Boolean(
              contact.name || contact.profileName
            );

            return (
              <ContactRow
                contact={contact}
                getPreferredBadge={getPreferredBadge}
                i18n={i18n}
                setSelectedContact={setSelectedContact}
                shouldShowNumber={shouldShowNumber}
                theme={theme}
              />
            );
          })}
        </ul>
      </ConfirmationDialog>
    );
  }

  actions.unshift({
    action: () => setIsReviewing(true),
    text: i18n('safetyNumberChangeDialog__review'),
  });

  return (
    <ConfirmationDialog
      key="SafetyNumberChangeDialog.manyContacts"
      dialogName="SafetyNumberChangeDialog.manyContacts"
      actions={actions}
      hasXButton
      i18n={i18n}
      moduleClassName="module-SafetyNumberChangeDialog__confirm-dialog"
      noMouseClose
      noDefaultCancelButton={!isReviewing}
      onCancel={onClose}
      onClose={noop}
    >
      <div className="module-SafetyNumberChangeDialog__shield-icon" />
      <div className="module-SafetyNumberChangeDialog__title">
        {i18n('safetyNumberChanges')}
      </div>
      <div className="module-SafetyNumberChangeDialog__message">
        {i18n('icu:safetyNumberChangeDialog__many-contacts', {
          count: contacts.length,
        })}
      </div>
    </ConfirmationDialog>
  );
};

type ContactRowProps = Readonly<{
  contact: ConversationType;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  setSelectedContact: (contact: ConversationType) => void;
  shouldShowNumber: boolean;
  theme: ThemeType;
}>;

function ContactRow({
  contact,
  getPreferredBadge,
  i18n,
  setSelectedContact,
  shouldShowNumber,
  theme,
}: ContactRowProps) {
  return (
    <li className="module-SafetyNumberChangeDialog__contact" key={contact.id}>
      <Avatar
        acceptedMessageRequest={contact.acceptedMessageRequest}
        avatarPath={contact.avatarPath}
        badge={getPreferredBadge(contact.badges)}
        color={contact.color}
        conversationType="direct"
        i18n={i18n}
        isMe={contact.isMe}
        phoneNumber={contact.phoneNumber}
        profileName={contact.profileName}
        theme={theme}
        title={contact.title}
        sharedGroupNames={contact.sharedGroupNames}
        size={36}
        unblurredAvatarPath={contact.unblurredAvatarPath}
      />
      <div className="module-SafetyNumberChangeDialog__contact--wrapper">
        <div className="module-SafetyNumberChangeDialog__contact--name">
          {contact.title}
          {isInSystemContacts(contact) ? (
            <span>
              {' '}
              <InContactsIcon i18n={i18n} />
            </span>
          ) : null}
        </div>
        {shouldShowNumber || contact.isVerified ? (
          <div className="module-SafetyNumberChangeDialog__contact--subtitle">
            {shouldShowNumber ? (
              <span className="module-SafetyNumberChangeDialog__rtl-span">
                {contact.phoneNumber}
              </span>
            ) : (
              ''
            )}
            {shouldShowNumber && contact.isVerified ? (
              <span className="module-SafetyNumberChangeDialog__rtl-span">
                &nbsp;&middot;&nbsp;
              </span>
            ) : (
              ''
            )}
            {contact.isVerified ? (
              <span className="module-SafetyNumberChangeDialog__rtl-span">
                {i18n('verified')}
              </span>
            ) : (
              ''
            )}
          </div>
        ) : null}
      </div>
      <button
        className="module-SafetyNumberChangeDialog__contact--view"
        onClick={() => {
          setSelectedContact(contact);
        }}
        tabIndex={0}
        type="button"
      >
        {i18n('view')}
      </button>
    </li>
  );
}
