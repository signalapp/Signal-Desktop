// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: PaymentEventNotification component removed for Orbital
// This file provides stub types to maintain compatibility

import React from 'react';
import type { AnyPaymentEvent } from '../../types/Payment.std.js';
import type { LocalizerType } from '../../types/Util.std.js';

export enum PaymentEventNotificationSize {
  Small = 'Small',
  Large = 'Large',
}

export type Props = {
  event: AnyPaymentEvent;
  i18n: LocalizerType;
  sender: string;
  conversationTitle: string;
  size?: PaymentEventNotificationSize;
};

export function PaymentEventNotification(_props: Props): JSX.Element {
  return <div>Payment feature removed</div>;
}
