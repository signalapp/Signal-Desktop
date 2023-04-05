// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { PropsType as ContactNameProps } from './ContactName';
import { ContactName } from './ContactName';
import { Button, ButtonVariant } from '../Button';
import type { Props as MessageRequestActionsConfirmationProps } from './MessageRequestActionsConfirmation';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from './MessageRequestActionsConfirmation';
import { Intl } from '../Intl';
import type { LocalizerType } from '../../types/Util';

export type Props = {
  i18n: LocalizerType;
  isHidden?: boolean;
} & Omit<ContactNameProps, 'module'> &
  Omit<
    MessageRequestActionsConfirmationProps,
    'i18n' | 'state' | 'onChangeState'
  >;

export function MessageRequestActions({
  acceptConversation,
  blockAndReportSpam,
  blockConversation,
  conversationId,
  conversationType,
  deleteConversation,
  firstName,
  i18n,
  isHidden,
  isBlocked,
  title,
}: Props): JSX.Element {
  const [mrState, setMrState] = React.useState(MessageRequestState.default);

  const name = (
    <strong
      key="name"
      className="module-message-request-actions__message__name"
    >
      <ContactName firstName={firstName} title={title} preferFirstName />
    </strong>
  );

  let message: JSX.Element | undefined;
  if (conversationType === 'direct') {
    if (isBlocked) {
      message = (
        <Intl
          i18n={i18n}
          id="icu:MessageRequests--message-direct-blocked"
          components={{ name }}
        />
      );
    } else if (isHidden) {
      message = (
        <Intl
          i18n={i18n}
          id="icu:MessageRequests--message-direct-hidden"
          components={{ name }}
        />
      );
    } else {
      message = (
        <Intl
          i18n={i18n}
          id="icu:MessageRequests--message-direct"
          components={{ name }}
        />
      );
    }
  } else if (conversationType === 'group') {
    if (isBlocked) {
      message = (
        <Intl i18n={i18n} id="icu:MessageRequests--message-group-blocked" />
      );
    } else {
      message = <Intl i18n={i18n} id="icu:MessageRequests--message-group" />;
    }
  }

  return (
    <>
      {mrState !== MessageRequestState.default ? (
        <MessageRequestActionsConfirmation
          acceptConversation={acceptConversation}
          blockAndReportSpam={blockAndReportSpam}
          blockConversation={blockConversation}
          conversationId={conversationId}
          conversationType={conversationType}
          deleteConversation={deleteConversation}
          i18n={i18n}
          onChangeState={setMrState}
          state={mrState}
          title={title}
        />
      ) : null}
      <div className="module-message-request-actions">
        <p className="module-message-request-actions__message">{message}</p>
        <div className="module-message-request-actions__buttons">
          <Button
            onClick={() => {
              setMrState(MessageRequestState.deleting);
            }}
            variant={ButtonVariant.SecondaryDestructive}
          >
            {i18n('icu:MessageRequests--delete')}
          </Button>
          {isBlocked ? (
            <Button
              onClick={() => {
                setMrState(MessageRequestState.unblocking);
              }}
              variant={ButtonVariant.SecondaryAffirmative}
            >
              {i18n('icu:MessageRequests--unblock')}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setMrState(MessageRequestState.blocking);
              }}
              variant={ButtonVariant.SecondaryDestructive}
            >
              {i18n('icu:MessageRequests--block')}
            </Button>
          )}
          {!isBlocked ? (
            <Button
              onClick={() => acceptConversation(conversationId)}
              variant={ButtonVariant.SecondaryAffirmative}
            >
              {i18n('icu:MessageRequests--accept')}
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
