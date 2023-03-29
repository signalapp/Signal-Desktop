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
  firstName?: string;
} & Omit<ContactNameProps, 'module'> &
  Pick<
    MessageRequestActionsConfirmationProps,
    | 'acceptConversation'
    | 'blockAndReportSpam'
    | 'blockConversation'
    | 'conversationId'
    | 'conversationType'
    | 'deleteConversation'
  >;

export function MandatoryProfileSharingActions({
  acceptConversation,
  blockAndReportSpam,
  blockConversation,
  conversationId,
  conversationType,
  deleteConversation,
  firstName,
  i18n,
  title,
}: Props): JSX.Element {
  const [mrState, setMrState] = React.useState(MessageRequestState.default);

  const firstNameContact = (
    <strong
      key="name"
      className="module-message-request-actions__message__name"
    >
      <ContactName firstName={firstName} title={title} preferFirstName />
    </strong>
  );

  const learnMore = (
    <a
      href="https://support.signal.org/hc/articles/360007459591"
      target="_blank"
      rel="noreferrer"
      className="module-message-request-actions__message__learn-more"
    >
      {i18n('MessageRequests--learn-more')}
    </a>
  );

  return (
    <>
      {mrState !== MessageRequestState.default ? (
        <MessageRequestActionsConfirmation
          acceptConversation={() => {
            throw new Error(
              'Should not be able to unblock from MandatoryProfileSharingActions'
            );
          }}
          blockConversation={blockConversation}
          conversationId={conversationId}
          deleteConversation={deleteConversation}
          i18n={i18n}
          blockAndReportSpam={blockAndReportSpam}
          title={title}
          conversationType={conversationType}
          state={mrState}
          onChangeState={setMrState}
        />
      ) : null}
      <div className="module-message-request-actions">
        <p className="module-message-request-actions__message">
          {conversationType === 'direct' ? (
            <Intl
              i18n={i18n}
              id="MessageRequests--profile-sharing--direct"
              components={{ firstName: firstNameContact, learnMore }}
            />
          ) : (
            <Intl
              i18n={i18n}
              id="MessageRequests--profile-sharing--group"
              components={{ firstName: firstNameContact, learnMore }}
            />
          )}
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
            onClick={() => acceptConversation(conversationId)}
            variant={ButtonVariant.SecondaryAffirmative}
          >
            {i18n('MessageRequests--continue')}
          </Button>
        </div>
      </div>
    </>
  );
}
