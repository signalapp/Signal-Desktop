// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { AxoExpireTimer } from './AxoExpireTimer.dom.tsx';
import { DurationSecs, TimestampMs } from '@signalapp/types';

export default {
  title: 'Axo/Message/AxoExpireTimer',
} satisfies Meta;

export function Basic(): ReactNode {
  return (
    <AxoExpireTimer.Root
      expireTimer={{
        duration: DurationSecs.fromSeconds(10),
        startedAt: TimestampMs.now(),
      }}
    />
  );
}
