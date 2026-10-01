// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';
import { ContactName } from './ContactName.dom.tsx';
import type { MessageRequestActionsConfirmationProps } from './MessageRequestActionsConfirmation.dom.tsx';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from './MessageRequestActionsConfirmation.dom.tsx';
import { I18n } from '../I18n.dom.tsx';
import type { LocalizerType } from '../../types/Util.std.ts';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoButton } from '../../axo/AxoButton.dom.tsx';

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
    className={tw('no-underline')}
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
  const [mrState, setMrState] = useState(MessageRequestState.default);

  const firstNameContact = (
    <span key="name" className={tw('font-semibold')}>
      <ContactName {...conversationName} preferFirstName />
    </span>
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
      <div
        className={tw('px-4 pt-2 pb-3')}
        data-testid="profile-sharing-actions"
      >
        <p className={tw('mb-3 text-center type-body-medium text-secondary')}>
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
        <AxoButton.Group>
          <AxoButton.Root
            onClick={() => {
              setMrState(MessageRequestState.blocking);
            }}
            size="md"
            variant="subtle-destructive"
          >
            {i18n('icu:MessageRequests--block')}
          </AxoButton.Root>
          <AxoButton.Root
            onClick={() => {
              setMrState(MessageRequestState.deleting);
            }}
            size="md"
            variant="subtle-destructive"
          >
            {i18n('icu:MessageRequests--delete')}
          </AxoButton.Root>
          <AxoButton.Root
            onClick={() => acceptConversation(conversationId)}
            size="md"
            variant="subtle-secondary"
          >
            {i18n('icu:MessageRequests--continue')}
          </AxoButton.Root>
        </AxoButton.Group>
      </div>
    </>
  );
}
