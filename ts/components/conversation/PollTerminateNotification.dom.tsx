// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../../types/Util.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import { SystemMessage } from './SystemMessage.dom.js';
import { Button, ButtonVariant, ButtonSize } from '../Button.dom.js';
import { UserText } from '../UserText.dom.js';
import { I18n } from '../I18n.dom.js';
import type { AciString } from '../../types/ServiceId.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { isAciString } from '../../util/isAciString.std.js';

export type PollTerminateNotificationDataType = {
  sender: ConversationType;
  pollQuestion: string;
  pollTimestamp: number;
  conversationId: string;
};
export type PollTerminateNotificationPropsType =
  PollTerminateNotificationDataType & {
    i18n: LocalizerType;
    scrollToPollMessage: (
      pollAuthorAci: AciString,
      pollTimestamp: number,
      conversationId: string
    ) => unknown;
  };

export function PollTerminateNotification({
  sender,
  pollQuestion,
  pollTimestamp,
  conversationId,
  i18n,
  scrollToPollMessage,
}: PollTerminateNotificationPropsType): React.JSX.Element {
  const handleViewPoll = () => {
    strictAssert(
      isAciString(sender.serviceId),
      'poll sender serviceId must be ACI'
    );
    scrollToPollMessage(sender.serviceId, pollTimestamp, conversationId);
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
