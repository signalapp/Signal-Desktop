// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import { SystemMessage } from './SystemMessage';
import { Emojify } from './Emojify';
import type { AnyPaymentEvent } from '../../types/Payment';
import { getPaymentEventDescription } from '../../messages/helpers';

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
