// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Payments feature removed
// This file exists as a stub to prevent import errors during the transition

import React from 'react';
import type { AnyPaymentEvent } from '../../types/Payment.std.js';
import type { LocalizerType } from '../../types/Util.std.js';

export type PropsType = {
  event: AnyPaymentEvent;
  i18n: LocalizerType;
  isIncoming: boolean;
  sender: {
    firstName?: string;
    title: string;
  };
};

export function PaymentEventNotification(_props: PropsType): JSX.Element {
  return <div>Payment notification removed</div>;
}
