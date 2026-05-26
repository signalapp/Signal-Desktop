// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { type JSX, useState } from 'react';
import type { LocalizerType } from '../../types/I18N.std.ts';
import { SystemMessage } from './SystemMessage.dom.tsx';
import { Button, ButtonSize, ButtonVariant } from '../Button.dom.tsx';
import { MessageRequestState } from './MessageRequestActionsConfirmation.dom.tsx';
import { SafetyTipsModal } from '../SafetyTipsModal.dom.tsx';
import { MessageRequestResponseEvent } from '../../types/MessageRequestResponseEvent.std.ts';
import { I18n } from '../I18n.dom.tsx';

export type MessageRequestResponseNotificationData = {
  messageRequestResponseEvent: MessageRequestResponseEvent;
};

export type MessageRequestResponseNotificationProps =
  MessageRequestResponseNotificationData & {
    i18n: LocalizerType;
    isBlocked: boolean;
    isGroup: boolean;
    onOpenMessageRequestActionsConfirmation: (
      state: MessageRequestState
    ) => void;
    renderedContact: JSX.Element | null;
  };

export function MessageRequestResponseNotification({
  i18n,
  isBlocked,
  isGroup,
  messageRequestResponseEvent: event,
  onOpenMessageRequestActionsConfirmation,
  renderedContact,
}: MessageRequestResponseNotificationProps): JSX.Element | null {
  const [isSafetyTipsModalOpen, setIsSafetyTipsModalOpen] = useState(false);

  return (
    <>
      {event === MessageRequestResponseEvent.ACCEPT && (
        <SystemMessage
          icon="thread"
          contents={
            isGroup || !renderedContact ? (
              i18n('icu:MessageRequestResponseNotification__Message--Accepted')
            ) : (
              <I18n
                i18n={i18n}
                id="icu:MessageRequestResponseNotification__Message--Accepted-Contact-Title"
                components={{ userProfileName: renderedContact }}
              />
            )
          }
          button={
            isBlocked ? null : (
              <Button
                className="MessageRequestResponseNotification__Button"
                size={ButtonSize.Small}
                variant={ButtonVariant.SystemMessage}
                onClick={() => {
                  onOpenMessageRequestActionsConfirmation(
                    MessageRequestState.acceptedOptions
                  );
                }}
              >
                {i18n(
                  'icu:MessageRequestResponseNotification__Button--block-or-report'
                )}
              </Button>
            )
          }
        />
      )}
      {event === MessageRequestResponseEvent.BLOCK && (
        <SystemMessage
          icon="block"
          contents={
            isGroup
              ? i18n(
                  'icu:MessageRequestResponseNotification__Message--Blocked--Group'
                )
              : i18n('icu:MessageRequestResponseNotification__Message--Blocked')
          }
        />
      )}
      {event === MessageRequestResponseEvent.UNBLOCK && (
        <SystemMessage
          icon="thread"
          contents={
            isGroup
              ? i18n(
                  'icu:MessageRequestResponseNotification__Message--Unblocked--Group'
                )
              : i18n(
                  'icu:MessageRequestResponseNotification__Message--Unblocked'
                )
          }
        />
      )}
      {event === MessageRequestResponseEvent.SPAM && (
        <SystemMessage
          icon="spam"
          contents={i18n(
            'icu:MessageRequestResponseNotification__Message--Reported'
          )}
          button={
            <Button
              className="MessageRequestResponseNotification__Button"
              size={ButtonSize.Small}
              variant={ButtonVariant.SystemMessage}
              onClick={() => {
                setIsSafetyTipsModalOpen(true);
              }}
            >
              {i18n(
                'icu:MessageRequestResponseNotification__Button--LearnMore'
              )}
            </Button>
          }
        />
      )}
      {isSafetyTipsModalOpen && (
        <SafetyTipsModal
          i18n={i18n}
          onClose={() => {
            setIsSafetyTipsModalOpen(false);
          }}
        />
      )}
    </>
  );
}
