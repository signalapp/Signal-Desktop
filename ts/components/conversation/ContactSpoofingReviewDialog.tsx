// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { FunctionComponent, useState } from 'react';

import { LocalizerType } from '../../types/Util';
import { ConversationType } from '../../state/ducks/conversations';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from './MessageRequestActionsConfirmation';

import { Modal } from '../Modal';
import { ContactSpoofingReviewDialogPerson } from './ContactSpoofingReviewDialogPerson';
import { Button, ButtonVariant } from '../Button';
import { assert } from '../../util/assert';

type PropsType = {
  i18n: LocalizerType;
  onBlock: () => unknown;
  onBlockAndDelete: () => unknown;
  onClose: () => void;
  onDelete: () => unknown;
  onShowContactModal: (contactId: string) => unknown;
  onUnblock: () => unknown;
  possiblyUnsafeConversation: ConversationType;
  safeConversation: ConversationType;
};

export const ContactSpoofingReviewDialog: FunctionComponent<PropsType> = ({
  i18n,
  onBlock,
  onBlockAndDelete,
  onClose,
  onDelete,
  onShowContactModal,
  onUnblock,
  possiblyUnsafeConversation,
  safeConversation,
}) => {
  assert(
    possiblyUnsafeConversation.type === 'direct',
    '<ContactSpoofingReviewDialog> expected a direct conversation for the "possibly unsafe" conversation'
  );
  assert(
    safeConversation.type === 'direct',
    '<ContactSpoofingReviewDialog> expected a direct conversation for the "safe" conversation'
  );

  const [messageRequestState, setMessageRequestState] = useState(
    MessageRequestState.default
  );

  if (messageRequestState !== MessageRequestState.default) {
    return (
      <MessageRequestActionsConfirmation
        i18n={i18n}
        onBlock={onBlock}
        onBlockAndDelete={onBlockAndDelete}
        onUnblock={onUnblock}
        onDelete={onDelete}
        name={possiblyUnsafeConversation.name}
        profileName={possiblyUnsafeConversation.profileName}
        phoneNumber={possiblyUnsafeConversation.phoneNumber}
        title={possiblyUnsafeConversation.title}
        conversationType="direct"
        state={messageRequestState}
        onChangeState={setMessageRequestState}
      />
    );
  }

  return (
    <Modal
      hasXButton
      i18n={i18n}
      moduleClassName="module-ContactSpoofingReviewDialog"
      onClose={onClose}
      title={i18n('ContactSpoofingReviewDialog__title')}
    >
      <p>{i18n('ContactSpoofingReviewDialog__description')}</p>
      <h2>{i18n('ContactSpoofingReviewDialog__possibly-unsafe-title')}</h2>
      <ContactSpoofingReviewDialogPerson
        conversation={possiblyUnsafeConversation}
        i18n={i18n}
      >
        <div className="module-ContactSpoofingReviewDialog__buttons">
          <Button
            variant={ButtonVariant.SecondaryDestructive}
            onClick={() => {
              setMessageRequestState(MessageRequestState.deleting);
            }}
          >
            {i18n('MessageRequests--delete')}
          </Button>
          <Button
            variant={ButtonVariant.SecondaryDestructive}
            onClick={() => {
              setMessageRequestState(MessageRequestState.blocking);
            }}
          >
            {i18n('MessageRequests--block')}
          </Button>
        </div>
      </ContactSpoofingReviewDialogPerson>
      <hr />
      <h2>{i18n('ContactSpoofingReviewDialog__safe-title')}</h2>
      <ContactSpoofingReviewDialogPerson
        conversation={safeConversation}
        i18n={i18n}
        onClick={() => {
          onShowContactModal(safeConversation.id);
        }}
      />
    </Modal>
  );
};
