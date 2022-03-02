// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { noop } from 'lodash';

import { Avatar } from './Avatar';
import { ConfirmationDialog } from './ConfirmationDialog';
import { InContactsIcon } from './InContactsIcon';
import { Modal } from './Modal';

import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { LocalizerType, ThemeType } from '../types/Util';
import { isInSystemContacts } from '../util/isInSystemContacts';

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
      <Modal hasXButton i18n={i18n} onClose={onClose}>
        {renderSafetyNumber({ contactID: selectedContact.id, onClose })}
      </Modal>
    );
  }

  return (
    <ConfirmationDialog
      actions={[
        {
          action: onConfirm,
          text: confirmText || i18n('sendMessageToContact'),
          style: 'affirmative',
        },
      ]}
      i18n={i18n}
      onCancel={onClose}
      onClose={noop}
      title={i18n('safetyNumberChanges')}
    >
      <div className="module-SafetyNumberChangeDialog__message">
        {i18n('changedVerificationWarning')}
      </div>
      <ul className="module-SafetyNumberChangeDialog__contacts">
        {contacts.map((contact: ConversationType) => {
          const shouldShowNumber = Boolean(contact.name || contact.profileName);

          return (
            <li
              className="module-SafetyNumberChangeDialog__contact"
              key={contact.id}
            >
              <Avatar
                acceptedMessageRequest={contact.acceptedMessageRequest}
                avatarPath={contact.avatarPath}
                badge={getPreferredBadge(contact.badges)}
                color={contact.color}
                conversationType="direct"
                i18n={i18n}
                isMe={contact.isMe}
                name={contact.name}
                phoneNumber={contact.phoneNumber}
                profileName={contact.profileName}
                theme={theme}
                title={contact.title}
                sharedGroupNames={contact.sharedGroupNames}
                size={52}
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
                {shouldShowNumber ? (
                  <div className="module-SafetyNumberChangeDialog__contact--number">
                    {contact.phoneNumber}
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
        })}
      </ul>
    </ConfirmationDialog>
  );
};
