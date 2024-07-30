// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { ContactNameData } from './ContactName';
import { ContactName } from './ContactName';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { I18n } from '../I18n';
import type { LocalizerType } from '../../types/Util';

export enum MessageRequestState {
  blocking,
  deleting,
  unblocking,
  reportingAndMaybeBlocking,
  acceptedOptions,
  default,
}

export type MessageRequestActionsConfirmationBaseProps = {
  addedByName: ContactNameData | null;
  conversationId: string;
  conversationType: 'group' | 'direct';
  conversationName: ContactNameData;
  isBlocked: boolean;
  isReported: boolean;
  acceptConversation(conversationId: string): void;
  blockAndReportSpam(conversationId: string): void;
  blockConversation(conversationId: string): void;
  reportSpam(conversationId: string): void;
  deleteConversation(conversationId: string): void;
};

export type MessageRequestActionsConfirmationProps =
  MessageRequestActionsConfirmationBaseProps & {
    i18n: LocalizerType;
    state: MessageRequestState;
    onChangeState(state: MessageRequestState): void;
  };

export function MessageRequestActionsConfirmation({
  addedByName,
  conversationId,
  conversationType,
  conversationName,
  i18n,
  isBlocked,
  state,
  acceptConversation,
  blockAndReportSpam,
  blockConversation,
  reportSpam,
  deleteConversation,
  onChangeState,
}: MessageRequestActionsConfirmationProps): JSX.Element | null {
  if (state === MessageRequestState.blocking) {
    return (
      <ConfirmationDialog
        key="messageRequestActionsConfirmation.blocking"
        dialogName="messageRequestActionsConfirmation.blocking"
        moduleClassName="MessageRequestActionsConfirmation"
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          conversationType === 'direct' ? (
            <I18n
              i18n={i18n}
              id="icu:MessageRequests--block-direct-confirm-title"
              components={{
                title: (
                  <ContactName
                    key="name"
                    {...conversationName}
                    preferFirstName
                  />
                ),
              }}
            />
          ) : (
            <I18n
              i18n={i18n}
              id="icu:MessageRequests--block-group-confirm-title"
              components={{
                title: (
                  <ContactName
                    key="name"
                    {...conversationName}
                    preferFirstName
                  />
                ),
              }}
            />
          )
        }
        actions={[
          {
            text: i18n('icu:MessageRequests--block'),
            action: () => blockConversation(conversationId),
            style: 'negative',
          },
        ]}
      >
        {conversationType === 'direct'
          ? i18n('icu:MessageRequests--block-direct-confirm-body')
          : i18n('icu:MessageRequests--block-group-confirm-body')}
      </ConfirmationDialog>
    );
  }

  if (state === MessageRequestState.reportingAndMaybeBlocking) {
    return (
      <ConfirmationDialog
        key="messageRequestActionsConfirmation.reportingAndMaybeBlocking"
        dialogName="messageRequestActionsConfirmation.reportingAndMaybeBlocking"
        moduleClassName="MessageRequestActionsConfirmation"
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={i18n('icu:MessageRequests--ReportAndMaybeBlockModal-title')}
        actions={[
          ...(!isBlocked
            ? ([
                {
                  text: i18n(
                    'icu:MessageRequests--ReportAndMaybeBlockModal-reportAndBlock'
                  ),
                  action: () => blockAndReportSpam(conversationId),
                  style: 'negative',
                },
              ] as const)
            : []),
          {
            text: i18n('icu:MessageRequests--ReportAndMaybeBlockModal-report'),
            action: () => reportSpam(conversationId),
            style: 'negative',
          },
        ]}
      >
        {/* eslint-disable-next-line no-nested-ternary */}
        {conversationType === 'direct' ? (
          i18n('icu:MessageRequests--ReportAndMaybeBlockModal-body--direct')
        ) : addedByName == null ? (
          i18n(
            'icu:MessageRequests--ReportAndMaybeBlockModal-body--group--unknown-contact'
          )
        ) : (
          <I18n
            i18n={i18n}
            id="icu:MessageRequests--ReportAndMaybeBlockModal-body--group"
            components={{
              name: <ContactName key="name" {...addedByName} preferFirstName />,
            }}
          />
        )}
      </ConfirmationDialog>
    );
  }

  if (state === MessageRequestState.unblocking) {
    return (
      <ConfirmationDialog
        key="messageRequestActionsConfirmation.unblocking"
        dialogName="messageRequestActionsConfirmation.unblocking"
        moduleClassName="MessageRequestActionsConfirmation"
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          <I18n
            i18n={i18n}
            id="icu:MessageRequests--unblock-direct-confirm-title"
            components={{
              name: (
                <ContactName key="name" {...conversationName} preferFirstName />
              ),
            }}
          />
        }
        actions={[
          {
            text: i18n('icu:MessageRequests--unblock'),
            action: () => acceptConversation(conversationId),
            style: 'affirmative',
          },
        ]}
      >
        {conversationType === 'direct'
          ? i18n('icu:MessageRequests--unblock-direct-confirm-body')
          : i18n('icu:MessageRequests--unblock-group-confirm-body')}
      </ConfirmationDialog>
    );
  }

  if (state === MessageRequestState.deleting) {
    return (
      <ConfirmationDialog
        key="messageRequestActionsConfirmation.deleting"
        dialogName="messageRequestActionsConfirmation.deleting"
        moduleClassName="MessageRequestActionsConfirmation"
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        title={
          conversationType === 'direct' ? (
            <I18n
              i18n={i18n}
              id="icu:MessageRequests--delete-direct-confirm-title"
            />
          ) : (
            <I18n
              i18n={i18n}
              id="icu:MessageRequests--delete-group-confirm-title"
              components={{
                title: (
                  <ContactName
                    key="name"
                    {...conversationName}
                    preferFirstName
                  />
                ),
              }}
            />
          )
        }
        actions={[
          {
            text:
              conversationType === 'direct'
                ? i18n('icu:MessageRequests--delete-direct')
                : i18n('icu:MessageRequests--delete-group'),
            action: () => deleteConversation(conversationId),
            style: 'negative',
          },
        ]}
      >
        {conversationType === 'direct'
          ? i18n('icu:MessageRequests--delete-direct-confirm-body')
          : i18n('icu:MessageRequests--delete-group-confirm-body')}
      </ConfirmationDialog>
    );
  }

  if (state === MessageRequestState.acceptedOptions) {
    return (
      <ConfirmationDialog
        key="messageRequestActionsConfirmation.acceptedOptions"
        dialogName="messageRequestActionsConfirmation.acceptedOptions"
        moduleClassName="MessageRequestActionsConfirmation"
        i18n={i18n}
        onClose={() => {
          onChangeState(MessageRequestState.default);
        }}
        actions={[
          {
            text: i18n('icu:MessageRequests--reportAndMaybeBlock'),
            action: () =>
              onChangeState(MessageRequestState.reportingAndMaybeBlocking),
            style: 'negative',
          },
          {
            text: i18n('icu:MessageRequests--block'),
            action: () => onChangeState(MessageRequestState.blocking),
            style: 'negative',
          },
        ]}
      >
        <I18n
          i18n={i18n}
          id="icu:MessageRequests--AcceptedOptionsModal--body"
          components={{
            name: (
              <ContactName key="name" {...conversationName} preferFirstName />
            ),
          }}
        />
      </ConfirmationDialog>
    );
  }

  return null;
}
