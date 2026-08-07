// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import type { ReactNode } from 'react';
import { AxoContactName } from './AxoContactName.dom.tsx';

export default {
  title: 'Axo/AxoContactName',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export function SystemContactEmblem(): ReactNode {
  return (
    <>
      <span dir="auto">Jamie</span>
      &nbsp;
      <AxoContactName.SystemContactEmblem />
    </>
  );
}
