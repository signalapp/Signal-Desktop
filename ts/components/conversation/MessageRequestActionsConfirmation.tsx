// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { PropsType as ContactNameProps } from './ContactName';
import { ContactName } from './ContactName';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { Intl } from '../Intl';
import type { LocalizerType } from '../../types/Util';

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
  onBlockAndReportSpam(): unknown;
  onUnblock(): unknown;
  onDelete(): unknown;
  state: MessageRequestState;
  onChangeState(state: MessageRequestState): unknown;
} & Omit<ContactNameProps, 'module'>;

export const MessageRequestActionsConfirmation = ({
  conversationType,
  i18n,
  onBlock,
  onBlockAndReportSpam,
  onChangeState,
  onDelete,
  onUnblock,
  state,
  title,
}: Props): JSX.Element | null => {
  if (state === MessageRequestState.blocking) {
    return (
      <ConfirmationDialog
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          <Intl
            i18n={i18n}
            id={`MessageRequests--block-${conversationType}-confirm-title`}
            components={[<ContactName key="name" title={title} />]}
          />
        }
        actions={[
          ...(conversationType === 'direct'
            ? [
                {
                  text: i18n('MessageRequests--block-and-report-spam'),
                  action: onBlockAndReportSpam,
                  style: 'negative' as const,
                },
              ]
            : []),
          {
            text: i18n('MessageRequests--block'),
            action: onBlock,
            style: 'negative',
          },
        ]}
      >
        {i18n(`MessageRequests--block-${conversationType}-confirm-body`)}
      </ConfirmationDialog>
    );
  }

  if (state === MessageRequestState.unblocking) {
    return (
      <ConfirmationDialog
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          <Intl
            i18n={i18n}
            id="MessageRequests--unblock-confirm-title"
            components={[<ContactName key="name" title={title} />]}
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
      </ConfirmationDialog>
    );
  }

  if (state === MessageRequestState.deleting) {
    return (
      <ConfirmationDialog
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          <Intl
            i18n={i18n}
            id={`MessageRequests--delete-${conversationType}-confirm-title`}
            components={[<ContactName key="name" title={title} />]}
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
      </ConfirmationDialog>
    );
  }

  return null;
};
