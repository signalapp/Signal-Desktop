// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { ContactName, PropsType as ContactNameProps } from './ContactName';
import { ConfirmationModal } from '../ConfirmationModal';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

export enum MessageRequestState {
  blocking,
  deleting,
  unblocking,
  default,
}

export type Props = {
  i18n: LocalizerType;
  conversationType: 'group' | 'direct';
  isBlocked?: boolean;
  onBlock(): unknown;
  onBlockAndDelete(): unknown;
  onUnblock(): unknown;
  onDelete(): unknown;
  state: MessageRequestState;
  onChangeState(state: MessageRequestState): unknown;
} & Omit<ContactNameProps, 'module' | 'i18n'>;

export const MessageRequestActionsConfirmation = ({
  conversationType,
  i18n,
  name,
  onBlock,
  onBlockAndDelete,
  onChangeState,
  onDelete,
  onUnblock,
  phoneNumber,
  profileName,
  state,
  title,
}: Props): JSX.Element | null => {
  if (state === MessageRequestState.blocking) {
    return (
      <ConfirmationModal
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          <Intl
            i18n={i18n}
            id={`MessageRequests--block-${conversationType}-confirm-title`}
            components={[
              <ContactName
                key="name"
                name={name}
                profileName={profileName}
                phoneNumber={phoneNumber}
                title={title}
                i18n={i18n}
              />,
            ]}
          />
        }
        actions={[
          {
            text: i18n('MessageRequests--block'),
            action: onBlock,
            style: 'negative',
          },
          {
            text: i18n('MessageRequests--block-and-delete'),
            action: onBlockAndDelete,
            style: 'negative',
          },
        ]}
      >
        {i18n(`MessageRequests--block-${conversationType}-confirm-body`)}
      </ConfirmationModal>
    );
  }

  if (state === MessageRequestState.unblocking) {
    return (
      <ConfirmationModal
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          <Intl
            i18n={i18n}
            id="MessageRequests--unblock-confirm-title"
            components={[
              <ContactName
                key="name"
                name={name}
                profileName={profileName}
                phoneNumber={phoneNumber}
                title={title}
                i18n={i18n}
              />,
            ]}
          />
        }
        actions={[
          {
            text: i18n('MessageRequests--unblock'),
            action: onUnblock,
            style: 'affirmative',
          },
        ]}
      >
        {i18n(`MessageRequests--unblock-${conversationType}-confirm-body`)}
      </ConfirmationModal>
    );
  }

  if (state === MessageRequestState.deleting) {
    return (
      <ConfirmationModal
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          <Intl
            i18n={i18n}
            id={`MessageRequests--delete-${conversationType}-confirm-title`}
            components={[
              <ContactName
                key="name"
                name={name}
                profileName={profileName}
                phoneNumber={phoneNumber}
                title={title}
                i18n={i18n}
              />,
            ]}
          />
        }
        actions={[
          {
            text: i18n(`MessageRequests--delete-${conversationType}`),
            action: onDelete,
            style: 'negative',
          },
        ]}
      >
        {i18n(`MessageRequests--delete-${conversationType}-confirm-body`)}
      </ConfirmationModal>
    );
  }

  return null;
};
