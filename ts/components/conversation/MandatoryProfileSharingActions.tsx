// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { ContactName } from './ContactName';
import { Button, ButtonVariant } from '../Button';
import type { MessageRequestActionsConfirmationProps } from './MessageRequestActionsConfirmation';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from './MessageRequestActionsConfirmation';
import { I18n } from '../I18n';
import type { LocalizerType } from '../../types/Util';

export type Props = {
  i18n: LocalizerType;
} & Pick<
  MessageRequestActionsConfirmationProps,
  | 'addedByName'
  | 'conversationId'
  | 'conversationType'
  | 'conversationName'
  | 'isBlocked'
  | 'isReported'
  | 'acceptConversation'
  | 'reportSpam'
  | 'blockAndReportSpam'
  | 'blockConversation'
  | 'deleteConversation'
>;

const learnMoreLink = (parts: Array<JSX.Element | string>) => (
  <a
    href="https://support.signal.org/hc/articles/360007459591"
    target="_blank"
    rel="noreferrer"
    className="module-message-request-actions__message__learn-more"
  >
    {parts}
  </a>
);

export function MandatoryProfileSharingActions({
  addedByName,
  conversationId,
  conversationType,
  conversationName,
  i18n,
  isBlocked,
  isReported,
  acceptConversation,
  reportSpam,
  blockAndReportSpam,
  blockConversation,
  deleteConversation,
}: Props): JSX.Element {
  const [mrState, setMrState] = React.useState(MessageRequestState.default);

  const firstNameContact = (
    <strong
      key="name"
      className="module-message-request-actions__message__name"
    >
      <ContactName {...conversationName} preferFirstName />
    </strong>
  );

  return (
    <>
      {mrState !== MessageRequestState.default ? (
        <MessageRequestActionsConfirmation
          addedByName={addedByName}
          conversationId={conversationId}
          conversationType={conversationType}
          conversationName={conversationName}
          i18n={i18n}
          isBlocked={isBlocked}
          isReported={isReported}
          state={mrState}
          acceptConversation={() => {
            throw new Error(
              'Should not be able to unblock from MandatoryProfileSharingActions'
            );
          }}
          blockConversation={blockConversation}
          deleteConversation={deleteConversation}
          reportSpam={reportSpam}
          blockAndReportSpam={blockAndReportSpam}
          onChangeState={setMrState}
        />
      ) : null}
      <div className="module-message-request-actions">
        <p className="module-message-request-actions__message">
          {conversationType === 'direct' ? (
            <I18n
              i18n={i18n}
              id="icu:MessageRequests--profile-sharing--direct--link"
              components={{ firstName: firstNameContact, learnMoreLink }}
            />
          ) : (
            <I18n
              i18n={i18n}
              id="icu:MessageRequests--profile-sharing--group--link"
              components={{ learnMoreLink }}
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
            {i18n('icu:MessageRequests--block')}
          </Button>
          <Button
            onClick={() => {
              setMrState(MessageRequestState.deleting);
            }}
            variant={ButtonVariant.SecondaryDestructive}
          >
            {i18n('icu:MessageRequests--delete')}
          </Button>
          <Button
            onClick={() => acceptConversation(conversationId)}
            variant={ButtonVariant.SecondaryAffirmative}
          >
            {i18n('icu:MessageRequests--continue')}
          </Button>
        </div>
      </div>
    </>
  );
}
