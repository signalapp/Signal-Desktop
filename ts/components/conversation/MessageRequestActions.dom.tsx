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
import { strictAssert } from '../../util/assert.std.ts';
import {
  useSharedGroupNamesOnMount,
  type GetSharedGroupNamesType,
} from '../../util/sharedGroupNames.dom.ts';
import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import { FlexWrapDetector } from '../../axo/_internal/FlexWrapDetector.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';

export type Props = {
  i18n: LocalizerType;
  isHidden: boolean | null;
  getSharedGroupNames: GetSharedGroupNamesType;
} & Omit<
  MessageRequestActionsConfirmationProps,
  'i18n' | 'state' | 'onChangeState'
>;

export function MessageRequestActions({
  addedByName,
  conversationId,
  conversationType,
  conversationName,
  getSharedGroupNames,
  i18n,
  isBlocked,
  isHidden,
  isReported,
  acceptConversation,
  blockAndReportSpam,
  blockConversation,
  reportSpam,
  deleteConversation,
}: Props): JSX.Element {
  const [mrState, setMrState] = useState(MessageRequestState.default);
  const sharedGroupNames = useSharedGroupNamesOnMount(
    conversationId,
    getSharedGroupNames
  );

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
        <div
          className={tw(
            // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
            'mb-2 text-center type-body-medium text-[#C84118] select-none'
          )}
        >
          <AxoSymbol.InlineGlyph symbol="error-triangle" label={null} />
          &nbsp;
          {i18n('icu:MessageRequestWarning__review-carefully')}
        </div>
        <p className="module-message-request-actions__message">{message}</p>
        <FlexWrapDetector>
          <div
            className={tw(
              'flex flex-wrap justify-center gap-2',
              '[&>button]:min-w-24',
              'container-scrollable:[&>button]:w-full'
            )}
          >
            {!isBlocked && (
              <AxoButton.Root
                onClick={() => {
                  setMrState(MessageRequestState.blocking);
                }}
                size="md"
                variant="subtle-destructive"
              >
                {i18n('icu:MessageRequests--block')}
              </AxoButton.Root>
            )}
            {(isReported || isBlocked) && (
              <AxoButton.Root
                onClick={() => {
                  setMrState(MessageRequestState.deleting);
                }}
                size="md"
                variant="subtle-destructive"
              >
                {i18n('icu:MessageRequests--delete')}
              </AxoButton.Root>
            )}
            {!isReported && (
              <AxoButton.Root
                onClick={() => {
                  setMrState(MessageRequestState.reportingAndMaybeBlocking);
                }}
                size="md"
                variant="subtle-destructive"
              >
                {i18n('icu:MessageRequests--reportAndMaybeBlock')}
              </AxoButton.Root>
            )}
            {isBlocked && (
              <AxoButton.Root
                onClick={() => {
                  setMrState(MessageRequestState.unblocking);
                }}
                size="md"
                variant="secondary"
              >
                {i18n('icu:MessageRequests--unblock')}
              </AxoButton.Root>
            )}
            {!isBlocked ? (
              <AxoButton.Root
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
                size="md"
                variant="secondary"
              >
                {i18n('icu:MessageRequests--accept')}
              </AxoButton.Root>
            ) : null}
          </div>
        </FlexWrapDetector>
      </div>
    </>
  );
}
