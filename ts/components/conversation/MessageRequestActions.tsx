// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { ContactName } from './ContactName.dom.js';
import { Button, ButtonVariant } from '../Button.dom.js';
import type { MessageRequestActionsConfirmationProps } from './MessageRequestActionsConfirmation.dom.js';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from './MessageRequestActionsConfirmation.dom.js';
import { I18n } from '../I18n.dom.js';
import type { LocalizerType } from '../../types/Util.std.js';
import { strictAssert } from '../../util/assert.std.js';

export type Props = {
  i18n: LocalizerType;
  isHidden: boolean | null;
  sharedGroupNames?: ReadonlyArray<string>;
} & Omit<
  MessageRequestActionsConfirmationProps,
  'i18n' | 'state' | 'onChangeState'
>;

export function MessageRequestActions({
  addedByName,
  conversationId,
  conversationType,
  conversationName,
  i18n,
  isBlocked,
  isHidden,
  isReported,
  sharedGroupNames = [],
  acceptConversation,
  blockAndReportSpam,
  blockConversation,
  reportSpam,
  deleteConversation,
}: Props): JSX.Element {
  const [mrState, setMrState] = React.useState(MessageRequestState.default);

  const nameValue =
    conversationType === 'direct' ? conversationName : addedByName;

  let message: JSX.Element | undefined;
  if (conversationType === 'direct') {
    strictAssert(nameValue != null, 'nameValue is null');
    const name = (
      <strong
        key="name"
        className="module-message-request-actions__message__name"
      >
        <ContactName {...nameValue} preferFirstName />
      </strong>
    );

    if (isBlocked) {
      message = (
        <I18n
          i18n={i18n}
          id="icu:MessageRequests--message-direct-blocked"
          components={{ name }}
        />
      );
    } else if (isHidden) {
      message = (
        <I18n
          i18n={i18n}
          id="icu:MessageRequests--message-direct-hidden"
          components={{ name }}
        />
      );
    } else {
      message = (
        <I18n
          i18n={i18n}
          id="icu:MessageRequests--message-direct"
          components={{ name }}
        />
      );
    }
  } else if (conversationType === 'group') {
    if (isBlocked) {
      message = (
        <I18n i18n={i18n} id="icu:MessageRequests--message-group-blocked" />
      );
    } else {
      message = <I18n i18n={i18n} id="icu:MessageRequests--message-group" />;
    }
  }

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
          acceptConversation={acceptConversation}
          blockAndReportSpam={blockAndReportSpam}
          blockConversation={blockConversation}
          reportSpam={reportSpam}
          deleteConversation={deleteConversation}
          onChangeState={setMrState}
        />
      ) : null}
      <div className="module-message-request-actions">
        <p className="module-message-request-actions__message">{message}</p>
        <div className="module-message-request-actions__buttons">
          {!isBlocked && (
            <Button
              onClick={() => {
                setMrState(MessageRequestState.blocking);
              }}
              variant={ButtonVariant.SecondaryDestructive}
            >
              {i18n('icu:MessageRequests--block')}
            </Button>
          )}
          {(isReported || isBlocked) && (
            <Button
              onClick={() => {
                setMrState(MessageRequestState.deleting);
              }}
              variant={ButtonVariant.SecondaryDestructive}
            >
              {i18n('icu:MessageRequests--delete')}
            </Button>
          )}
          {!isReported && (
            <Button
              onClick={() => {
                setMrState(MessageRequestState.reportingAndMaybeBlocking);
              }}
              variant={ButtonVariant.SecondaryDestructive}
            >
              {i18n('icu:MessageRequests--reportAndMaybeBlock')}
            </Button>
          )}
          {isBlocked && (
            <Button
              onClick={() => {
                setMrState(MessageRequestState.unblocking);
              }}
              variant={ButtonVariant.SecondaryAffirmative}
            >
              {i18n('icu:MessageRequests--unblock')}
            </Button>
          )}
          {!isBlocked ? (
            <Button
              onClick={() => {
                if (
                  conversationType === 'direct' &&
                  sharedGroupNames.length > 1
                ) {
                  acceptConversation(conversationId);
                } else {
                  setMrState(MessageRequestState.accepting);
                }
              }}
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
