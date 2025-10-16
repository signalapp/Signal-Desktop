// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import type { LocalizerType } from '../../types/I18N.std.js';
import { SystemMessage } from './SystemMessage.dom.js';
import { Button, ButtonSize, ButtonVariant } from '../Button.dom.js';
import { MessageRequestState } from './MessageRequestActionsConfirmation.dom.js';
import { SafetyTipsModal } from '../SafetyTipsModal.dom.js';
import { MessageRequestResponseEvent } from '../../types/MessageRequestResponseEvent.std.js';

export type MessageRequestResponseNotificationData = {
  messageRequestResponseEvent: MessageRequestResponseEvent;
};

export type MessageRequestResponseNotificationProps =
  MessageRequestResponseNotificationData & {
    i18n: LocalizerType;
    isBlocked: boolean;
    isGroup: boolean;
    onOpenMessageRequestActionsConfirmation(state: MessageRequestState): void;
  };

export function MessageRequestResponseNotification({
  i18n,
  isBlocked,
  isGroup,
  messageRequestResponseEvent: event,
  onOpenMessageRequestActionsConfirmation,
}: MessageRequestResponseNotificationProps): JSX.Element | null {
  const [isSafetyTipsModalOpen, setIsSafetyTipsModalOpen] = useState(false);

  return (
    <>
      {event === MessageRequestResponseEvent.ACCEPT && (
        <SystemMessage
          icon="thread"
          contents={i18n(
            'icu:MessageRequestResponseNotification__Message--Accepted'
          )}
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
                  'icu:MessageRequestResponseNotification__Button--Options'
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
