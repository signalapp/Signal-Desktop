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
  Pick<
    MessageRequestActionsConfirmationProps,
    'conversationType' | 'onBlock' | 'onBlockAndDelete' | 'onDelete'
  >;

export const MandatoryProfileSharingActions = ({
  conversationType,
  firstName,
  i18n,
  name,
  onAccept,
  onBlock,
  onBlockAndDelete,
  onDelete,
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
          onBlockAndDelete={onBlockAndDelete}
          onUnblock={() => {
            throw new Error(
              'Should not be able to unblock from MandatoryProfileSharingActions'
            );
          }}
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
            id={`MessageRequests--profile-sharing--${conversationType}`}
            components={{
              firstName: (
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
                </strong>
              ),
              learnMore: (
                <a
                  href="https://support.signal.org/hc/articles/360007459591"
                  target="_blank"
                  rel="noreferrer"
                  className="module-message-request-actions__message__learn-more"
                >
                  {i18n('MessageRequests--learn-more')}
                </a>
              ),
            }}
          />
        </p>
        <div className="module-message-request-actions__buttons">
          <Button
            onClick={() => {
              setMrState(MessageRequestState.blocking);
            }}
            variant={ButtonVariant.SecondaryDestructive}
          >
            {i18n('MessageRequests--block')}
          </Button>
          <Button
            onClick={() => {
              setMrState(MessageRequestState.deleting);
            }}
            variant={ButtonVariant.SecondaryDestructive}
          >
            {i18n('MessageRequests--delete')}
          </Button>
          <Button
            onClick={onAccept}
            variant={ButtonVariant.SecondaryAffirmative}
          >
            {i18n('MessageRequests--continue')}
          </Button>
        </div>
      </div>
    </>
  );
};
