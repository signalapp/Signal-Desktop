// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback } from 'react';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../../types/Util.std.ts';
import { I18n } from '../../I18n.dom.tsx';
import { SystemMessage } from '../SystemMessage.dom.tsx';
import { UserText } from '../../UserText.dom.tsx';
import { Button, ButtonSize, ButtonVariant } from '../../Button.dom.tsx';
import type { PinMessageData } from '../../../model-types.d.ts';

export type PinnedMessageNotificationData = Readonly<{
  sender: ConversationType;
  pinMessage: PinMessageData;
}>;

export type PinnedMessageNotificationProps = PinnedMessageNotificationData &
  Readonly<{
    i18n: LocalizerType;
    onScrollToPinnedMessage: (pinMessage: PinMessageData) => void;
  }>;

export function PinnedMessageNotification(
  props: PinnedMessageNotificationProps
): React.JSX.Element {
  const { i18n, sender, pinMessage, onScrollToPinnedMessage } = props;

  const onClick = useCallback(() => {
    onScrollToPinnedMessage(pinMessage);
  }, [onScrollToPinnedMessage, pinMessage]);

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
