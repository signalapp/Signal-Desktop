// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../../types/Util.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import { SystemMessage } from './SystemMessage.dom.js';
import { Button, ButtonVariant, ButtonSize } from '../Button.dom.js';

export type PropsType = {
  sender: ConversationType;
  pollQuestion: string;
  pollMessageId: string;
  conversationId: string;
  i18n: LocalizerType;
  scrollToPollMessage: (messageId: string, conversationId: string) => unknown;
};

export function PollTerminateNotification({
  sender,
  pollQuestion,
  pollMessageId,
  conversationId,
  i18n,
  scrollToPollMessage,
}: PropsType): JSX.Element {
  const message = sender.isMe
    ? i18n('icu:PollTerminate--you', { poll: pollQuestion })
    : i18n('icu:PollTerminate--other', {
        name: sender.title,
        poll: pollQuestion,
      });

  const handleViewPoll = () => {
    scrollToPollMessage(pollMessageId, conversationId);
  };

  return (
    <SystemMessage
      symbol="poll"
      contents={message}
      button={
        <Button
          onClick={handleViewPoll}
          variant={ButtonVariant.SystemMessage}
          size={ButtonSize.Small}
        >
          {i18n('icu:PollTerminate__view-poll')}
        </Button>
      }
    />
  );
}
