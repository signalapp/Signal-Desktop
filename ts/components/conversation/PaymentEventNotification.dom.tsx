// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../types/Util.std.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import { SystemMessage } from './SystemMessage.dom.tsx';
import { Emojify } from './Emojify.dom.tsx';
import type { AnyPaymentEvent } from '../../types/Payment.std.ts';
import { getPaymentEventDescription } from '../../messages/payments.std.ts';

export type PropsType = {
  event: AnyPaymentEvent;
  sender: ConversationType;
  conversation: ConversationType;
  i18n: LocalizerType;
};

export function PaymentEventNotification(props: PropsType): React.JSX.Element {
  const { event, sender, conversation, i18n } = props;
  const message = getPaymentEventDescription(
    event,
    sender.title,
    conversation.title,
    sender.isMe,
    i18n
  );
  return (
    <SystemMessage icon="payment-event" contents={<Emojify text={message} />} />
  );
}
