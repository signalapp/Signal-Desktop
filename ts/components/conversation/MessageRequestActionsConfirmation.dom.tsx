// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type { ContactNameData } from './ContactName.dom.tsx';
import { ContactName } from './ContactName.dom.tsx';
import { I18n } from '../I18n.dom.tsx';
import type { LocalizerType } from '../../types/Util.std.ts';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';

export enum MessageRequestState {
  blocking,
  deleting,
  unblocking,
  reportingAndMaybeBlocking,
  acceptedOptions,
  accepting,
  default,
}

export type MessageRequestActionsConfirmationBaseProps = {
  addedByName: ContactNameData | null;
  conversationId: string;
  conversationType: 'group' | 'direct';
  conversationName: ContactNameData | undefined;
  isSignalConversation: boolean;
  isBlocked: boolean;
  isReported: boolean;
  acceptConversation: (conversationId: string) => void;
  blockAndReportSpam: (conversationId: string) => void;
  blockConversation: (conversationId: string) => void;
  reportSpam: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
};

export type MessageRequestActionsConfirmationProps =
  MessageRequestActionsConfirmationBaseProps & {
    i18n: LocalizerType;
    state: MessageRequestState;
    onChangeState: (state: MessageRequestState) => void;
  };

function Bold(parts: Array<string | JSX.Element>) {
  return <strong>{parts}</strong>;
}

function getUnblockConfirmBody({
  conversationType,
  i18n,
  isSignalConversation,
}: {
  conversationType: 'group' | 'direct';
  i18n: LocalizerType;
  isSignalConversation: boolean;
}): string {
  if (conversationType === 'group') {
    return i18n('icu:MessageRequests--unblock-group-confirm-body');
  }
  if (isSignalConversation) {
    return i18n('icu:MessageRequests--unblock-signal-confirm-body');
  }
  return i18n('icu:MessageRequests--unblock-direct-confirm-body');
}

function getBlockConfirmBody({
  conversationType,
  i18n,
  isSignalConversation,
}: {
  conversationType: 'group' | 'direct';
  i18n: LocalizerType;
  isSignalConversation: boolean;
}): string {
  if (conversationType === 'group') {
    return i18n('icu:MessageRequests--block-group-confirm-body');
  }
  if (isSignalConversation) {
    return i18n('icu:MessageRequests--block-signal-confirm-body');
  }
  return i18n('icu:MessageRequests--block-direct-confirm-body');
}

export function MessageRequestActionsConfirmation({
  addedByName,
  conversationId,
  conversationType,
  conversationName = { title: '' },
  i18n,
  isBlocked,
  isSignalConversation,
  state,
  acceptConversation,
  blockAndReportSpam,
  blockConversation,
  reportSpam,
  deleteConversation,
  onChangeState,
}: MessageRequestActionsConfirmationProps): JSX.Element | null {
  return (
    <>
      <AxoConfirmDialog.Root
        open={state === MessageRequestState.blocking}
        onCancel={() => onChangeState(MessageRequestState.default)}
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
        description={getBlockConfirmBody({
          conversationType,
          i18n,
          isSignalConversation,
        })}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={() => {
            onChangeState(MessageRequestState.default);
            blockConversation(conversationId);
          }}
        >
          {i18n('icu:MessageRequests--block')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={state === MessageRequestState.reportingAndMaybeBlocking}
        onCancel={() => onChangeState(MessageRequestState.default)}
        title={i18n('icu:MessageRequests--ReportAndMaybeBlockModal-title')}
        description={
          <>
            {/* oxlint-disable-next-line no-nested-ternary */}
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
                  name: (
                    <ContactName key="name" {...addedByName} preferFirstName />
                  ),
                }}
              />
            )}
          </>
        }
      >
        <AxoConfirmDialog.Cancel />
        {!isBlocked && (
          <AxoConfirmDialog.Action
            variant="strong-destructive"
            onClick={() => {
              onChangeState(MessageRequestState.default);
              blockAndReportSpam(conversationId);
            }}
          >
            {i18n(
              'icu:MessageRequests--ReportAndMaybeBlockModal-reportAndBlock'
            )}
          </AxoConfirmDialog.Action>
        )}
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={() => {
            onChangeState(MessageRequestState.default);
            reportSpam(conversationId);
          }}
        >
          {i18n('icu:MessageRequests--ReportAndMaybeBlockModal-report')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={state === MessageRequestState.unblocking}
        onCancel={() => onChangeState(MessageRequestState.default)}
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
        description={getUnblockConfirmBody({
          conversationType,
          i18n,
          isSignalConversation,
        })}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-primary"
          onClick={() => {
            onChangeState(MessageRequestState.default);
            acceptConversation(conversationId);
          }}
        >
          {i18n('icu:MessageRequests--unblock')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={state === MessageRequestState.deleting}
        onCancel={() => onChangeState(MessageRequestState.default)}
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
        description={
          conversationType === 'direct'
            ? i18n('icu:MessageRequests--delete-direct-confirm-body')
            : i18n('icu:MessageRequests--delete-group-confirm-body')
        }
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={() => {
            onChangeState(MessageRequestState.default);
            deleteConversation(conversationId);
          }}
        >
          {conversationType === 'direct'
            ? i18n('icu:MessageRequests--delete-direct')
            : i18n('icu:MessageRequests--delete-group')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={state === MessageRequestState.acceptedOptions}
        onCancel={() => onChangeState(MessageRequestState.default)}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={
          <I18n
            i18n={i18n}
            id="icu:MessageRequests--AcceptedOptionsModal--body"
            components={{
              name: (
                <ContactName key="name" {...conversationName} preferFirstName />
              ),
            }}
          />
        }
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={() =>
            onChangeState(MessageRequestState.reportingAndMaybeBlocking)
          }
        >
          {i18n('icu:MessageRequests--reportAndMaybeBlock')}
        </AxoConfirmDialog.Action>
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={() => onChangeState(MessageRequestState.blocking)}
        >
          {i18n('icu:MessageRequests--block')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={state === MessageRequestState.accepting}
        onCancel={() => onChangeState(MessageRequestState.default)}
        title={i18n('icu:MessageRequests--accept-confirm-title-v2')}
        description={
          <I18n
            i18n={i18n}
            id="icu:MessageRequests--accept-confirm-body-v2"
            components={{ bold: Bold }}
          />
        }
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-primary"
          onClick={() => {
            onChangeState(MessageRequestState.default);
            acceptConversation(conversationId);
          }}
        >
          {i18n('icu:MessageRequests--accept')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    </>
  );
}
