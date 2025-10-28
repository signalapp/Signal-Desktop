// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../types/Util.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import { SystemMessage } from './SystemMessage.dom.js';
import { Emojify } from './Emojify.dom.js';
import type { AnyPaymentEvent } from '../../types/Payment.std.js';
import { getPaymentEventDescription } from '../../messages/payments.std.js';

export type PropsType = {
  event: AnyPaymentEvent;
  sender: ConversationType;
  conversation: ConversationType;
  i18n: LocalizerType;
};

export function PaymentEventNotification(props: PropsType): JSX.Element {
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
