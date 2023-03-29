// Copyright 2020 Signal Messenger, LLC
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
  acceptConversation(conversationId: string): unknown;
  blockAndReportSpam(conversationId: string): unknown;
  blockConversation(conversationId: string): unknown;
  conversationId: string;
  conversationType: 'group' | 'direct';
  deleteConversation(conversationId: string): unknown;
  i18n: LocalizerType;
  isBlocked?: boolean;
  onChangeState(state: MessageRequestState): unknown;
  state: MessageRequestState;
} & Omit<ContactNameProps, 'module'>;

export function MessageRequestActionsConfirmation({
  acceptConversation,
  blockAndReportSpam,
  blockConversation,
  conversationId,
  conversationType,
  deleteConversation,
  i18n,
  onChangeState,
  state,
  title,
}: Props): JSX.Element | null {
  if (state === MessageRequestState.blocking) {
    return (
      <ConfirmationDialog
        dialogName="messageRequestActionsConfirmation.blocking"
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          conversationType === 'direct' ? (
            <Intl
              i18n={i18n}
              id="MessageRequests--block-direct-confirm-title"
              components={{
                title: <ContactName key="name" title={title} />,
              }}
            />
          ) : (
            <Intl
              i18n={i18n}
              id="MessageRequests--block-group-confirm-title"
              components={{
                title: <ContactName key="name" title={title} />,
              }}
            />
          )
        }
        actions={[
          ...(conversationType === 'direct'
            ? [
                {
                  text: i18n('MessageRequests--block-and-report-spam'),
                  action: () => blockAndReportSpam(conversationId),
                  style: 'negative' as const,
                },
              ]
            : []),
          {
            text: i18n('MessageRequests--block'),
            action: () => blockConversation(conversationId),
            style: 'negative',
          },
        ]}
      >
        {conversationType === 'direct'
          ? i18n('MessageRequests--block-direct-confirm-body')
          : i18n('MessageRequests--block-group-confirm-body')}
      </ConfirmationDialog>
    );
  }

  if (state === MessageRequestState.unblocking) {
    return (
      <ConfirmationDialog
        dialogName="messageRequestActionsConfirmation.unblocking"
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          <Intl
            i18n={i18n}
            id="MessageRequests--unblock-direct-confirm-title"
            components={{
              name: <ContactName key="name" title={title} />,
            }}
          />
        }
        actions={[
          {
            text: i18n('MessageRequests--unblock'),
            action: () => acceptConversation(conversationId),
            style: 'affirmative',
          },
        ]}
      >
        {conversationType === 'direct'
          ? i18n('MessageRequests--unblock-direct-confirm-body')
          : i18n('MessageRequests--unblock-group-confirm-body')}
      </ConfirmationDialog>
    );
  }

  if (state === MessageRequestState.deleting) {
    return (
      <ConfirmationDialog
        dialogName="messageRequestActionsConfirmation.deleting"
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          conversationType === 'direct' ? (
            <Intl
              i18n={i18n}
              id="MessageRequests--delete-direct-confirm-title"
              components={{
                title: <ContactName key="name" title={title} />,
              }}
            />
          ) : (
            <Intl
              i18n={i18n}
              id="MessageRequests--delete-group-confirm-title"
              components={{
                title: <ContactName key="name" title={title} />,
              }}
            />
          )
        }
        actions={[
          {
            text:
              conversationType === 'direct'
                ? i18n('MessageRequests--delete-direct')
                : i18n('MessageRequests--delete-group'),
            action: () => deleteConversation(conversationId),
            style: 'negative',
          },
        ]}
      >
        {conversationType === 'direct'
          ? i18n('MessageRequests--delete-direct-confirm-body')
          : i18n('MessageRequests--delete-group-confirm-body')}
      </ConfirmationDialog>
    );
  }

  return null;
}
