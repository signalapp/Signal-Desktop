// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { ContactName, PropsType as ContactNameProps } from './ContactName';
import { Button, ButtonVariant } from '../Button';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
  Props as MessageRequestActionsConfirmationProps,
} from './MessageRequestActionsConfirmation';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

export type Props = {
  i18n: LocalizerType;
  firstName?: string;
  onAccept(): unknown;
} & Omit<ContactNameProps, 'module' | 'i18n'> &
  Omit<
    MessageRequestActionsConfirmationProps,
    'i18n' | 'state' | 'onChangeState'
  >;

export const MessageRequestActions = ({
  conversationType,
  firstName,
  i18n,
  isBlocked,
  name,
  onAccept,
  onBlock,
  onBlockAndReportSpam,
  onDelete,
  onUnblock,
  phoneNumber,
  profileName,
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
          name={name}
          profileName={profileName}
          phoneNumber={phoneNumber}
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
                  name={name}
                  profileName={profileName}
                  phoneNumber={phoneNumber}
                  title={firstName || title}
                  i18n={i18n}
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
