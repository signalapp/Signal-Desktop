// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../../types/Util.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import { SystemMessage } from './SystemMessage.dom.js';
import { Button, ButtonVariant, ButtonSize } from '../Button.dom.js';
import { UserText } from '../UserText.dom.js';
import { I18n } from '../I18n.dom.js';

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
  const handleViewPoll = () => {
    scrollToPollMessage(pollMessageId, conversationId);
  };

  const message = sender.isMe ? (
    <I18n
      i18n={i18n}
      id="icu:PollTerminate--you"
      components={{
        poll: <UserText text={pollQuestion} />,
      }}
    />
  ) : (
    <I18n
      i18n={i18n}
      id="icu:PollTerminate--other"
      components={{
        name: <UserText text={sender.title} />,
        poll: <UserText text={pollQuestion} />,
      }}
    />
  );

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
