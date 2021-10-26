// Copyright 2020-2021 Signal Messenger, LLC
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
  onAccept(): unknown;
} & Omit<ContactNameProps, 'module'> &
  Omit<
    MessageRequestActionsConfirmationProps,
    'i18n' | 'state' | 'onChangeState'
  >;

export const MessageRequestActions = ({
  conversationType,
  firstName,
  i18n,
  isBlocked,
  onAccept,
  onBlock,
  onBlockAndReportSpam,
  onDelete,
  onUnblock,
  title,
}: Props): JSX.Element => {
  const [mrState, setMrState] = React.useState(MessageRequestState.default);

  return (
    <>
      {mrState !== MessageRequestState.default ? (
        <MessageRequestActionsConfirmation
          i18n={i18n}
          onBlock={onBlock}
          onBlockAndReportSpam={onBlockAndReportSpam}
          onUnblock={onUnblock}
          onDelete={onDelete}
          title={title}
          conversationType={conversationType}
          state={mrState}
          onChangeState={setMrState}
        />
      ) : null}
      <div className="module-message-request-actions">
        <p className="module-message-request-actions__message">
          <Intl
            i18n={i18n}
            id={`MessageRequests--message-${conversationType}${
              isBlocked ? '-blocked' : ''
            }`}
            components={[
              <strong
                key="name"
                className="module-message-request-actions__message__name"
              >
                <ContactName
                  firstName={firstName}
                  title={title}
                  preferFirstName
                />
              </strong>,
            ]}
          />
        </p>
        <div className="module-message-request-actions__buttons">
          <Button
            onClick={() => {
              setMrState(MessageRequestState.deleting);
            }}
            variant={ButtonVariant.SecondaryDestructive}
          >
            {i18n('MessageRequests--delete')}
          </Button>
          {isBlocked ? (
            <Button
              onClick={() => {
                setMrState(MessageRequestState.unblocking);
              }}
              variant={ButtonVariant.SecondaryAffirmative}
            >
              {i18n('MessageRequests--unblock')}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setMrState(MessageRequestState.blocking);
              }}
              variant={ButtonVariant.SecondaryDestructive}
            >
              {i18n('MessageRequests--block')}
            </Button>
          )}
          {!isBlocked ? (
            <Button
              onClick={onAccept}
              variant={ButtonVariant.SecondaryAffirmative}
            >
              {i18n('MessageRequests--accept')}
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
};
