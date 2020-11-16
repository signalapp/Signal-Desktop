// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { Avatar } from './Avatar';
import { ConfirmationModal } from './ConfirmationModal';
import { InContactsIcon } from './InContactsIcon';

import { ConversationType } from '../state/ducks/conversations';
import { LocalizerType } from '../types/Util';

type SafetyNumberProps = {
  contactID: string;
  onClose?: () => void;
};

export type Props = {
  readonly confirmText?: string;
  readonly contacts: Array<ConversationType>;
  readonly i18n: LocalizerType;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly renderSafetyNumber: (props: SafetyNumberProps) => JSX.Element;
};

type SafetyDialogContentProps = Props & {
  readonly onView: (contact: ConversationType) => void;
};

const SafetyDialogContents = ({
  confirmText,
  contacts,
  i18n,
  onCancel,
  onConfirm,
  onView,
}: SafetyDialogContentProps): JSX.Element => {
  const cancelButtonRef = React.createRef<HTMLButtonElement>();

  React.useEffect(() => {
    if (cancelButtonRef && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [cancelButtonRef, contacts]);

  return (
    <>
      <h1 className="module-sfn-dialog__title">
        {i18n('safetyNumberChanges')}
      </h1>
      <div className="module-sfn-dialog__message">
        {i18n('changedVerificationWarning')}
      </div>
      <ul className="module-sfn-dialog__contacts">
        {contacts.map((contact: ConversationType) => {
          const shouldShowNumber = Boolean(contact.name || contact.profileName);

          return (
            <li className="module-sfn-dialog__contact" key={contact.id}>
              <Avatar
                avatarPath={contact.avatarPath}
                color={contact.color}
                conversationType="direct"
                i18n={i18n}
                name={contact.name}
                phoneNumber={contact.phoneNumber}
                profileName={contact.profileName}
                title={contact.title}
                size={52}
              />
              <div className="module-sfn-dialog__contact--wrapper">
                <div className="module-sfn-dialog__contact--name">
                  {contact.title}
                  {contact.name ? (
                    <span>
                      {' '}
                      <InContactsIcon i18n={i18n} />
                    </span>
                  ) : null}
                </div>
                {shouldShowNumber ? (
                  <div className="module-sfn-dialog__contact--number">
                    {contact.phoneNumber}
                  </div>
                ) : null}
              </div>
              <button
                className="module-sfn-dialog__contact--view"
                onClick={() => {
                  onView(contact);
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
      <div className="module-sfn-dialog__actions">
        <button
          className="module-sfn-dialog__actions--cancel"
          onClick={onCancel}
          ref={cancelButtonRef}
          tabIndex={0}
          type="button"
        >
          {i18n('cancel')}
        </button>
        <button
          className="module-sfn-dialog__actions--confirm"
          onClick={onConfirm}
          tabIndex={0}
          type="button"
        >
          {confirmText || i18n('sendMessageToContact')}
        </button>
      </div>
    </>
  );
};

export const SafetyNumberChangeDialog = (props: Props): JSX.Element => {
  const { i18n, onCancel, renderSafetyNumber } = props;
  const [contact, setViewSafetyNumber] = React.useState<
    ConversationType | undefined
  >(undefined);

  const onClose = contact
    ? () => {
        setViewSafetyNumber(undefined);
      }
    : onCancel;

  return (
    <ConfirmationModal actions={[]} i18n={i18n} onClose={onClose}>
      {contact && renderSafetyNumber({ contactID: contact.id, onClose })}
      {!contact && (
        <SafetyDialogContents
          {...props}
          onView={selectedContact => {
            setViewSafetyNumber(selectedContact);
          }}
        />
      )}
    </ConfirmationModal>
  );
};
