// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { AxoOutgoingStatus } from './AxoOutgoingStatus.dom.tsx';
import { tw } from '../tw.dom.tsx';

export default {
  title: 'Axo/Message/AxoOutgoingStatus',
} satisfies Meta;

export function AllStatuses(): ReactNode {
  return (
    <div className={tw('flex gap-2 type-body-large')}>
      <AxoOutgoingStatus.Root status="sending" label="Sending" />
      <AxoOutgoingStatus.Root status="sent" label="Sent" />
      <AxoOutgoingStatus.Root status="delivered" label="Delivered" />
      <AxoOutgoingStatus.Root status="read" label="Read" />
      <AxoOutgoingStatus.Root status="paused" label="Paused" />
      <AxoOutgoingStatus.Root status="error" label="Failed to send" />
    </div>
  );
}
