// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback } from 'react';
import type { ConversationType } from '../../../state/ducks/conversations.preload.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import { I18n } from '../../I18n.dom.js';
import { SystemMessage } from '../SystemMessage.dom.js';
import { UserText } from '../../UserText.dom.js';
import { Button, ButtonSize, ButtonVariant } from '../../Button.dom.js';

export type PinnedMessageNotificationData = Readonly<{
  sender: ConversationType;
  pinnedMessageId: string;
}>;

export type PinnedMessageNotificationProps = PinnedMessageNotificationData &
  Readonly<{
    i18n: LocalizerType;
    onScrollToPinnedMessage: (messageId: string) => void;
  }>;

export function PinnedMessageNotification(
  props: PinnedMessageNotificationProps
): JSX.Element {
  const { i18n, sender, pinnedMessageId, onScrollToPinnedMessage } = props;

  const onClick = useCallback(() => {
    onScrollToPinnedMessage(pinnedMessageId);
  }, [onScrollToPinnedMessage, pinnedMessageId]);

  return (
    <SystemMessage
      symbol="pin"
      contents={
        sender.isMe ? (
          i18n('icu:PinnedMessageNotification__Message--You')
        ) : (
          <I18n
            id="icu:PinnedMessageNotification__Message--SomeoneElse"
            components={{
              sender: <UserText text={sender.title} />,
            }}
            i18n={i18n}
          />
        )
      }
      button={
        <Button
          onClick={onClick}
          size={ButtonSize.Small}
          variant={ButtonVariant.SystemMessage}
        >
          {i18n('icu:PinnedMessageNotification__Button')}
        </Button>
      }
    />
  );
}
