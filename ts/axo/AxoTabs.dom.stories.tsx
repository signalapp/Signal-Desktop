// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import { useState, type ReactNode } from 'react';
import { AxoTabs } from './AxoTabs.dom.tsx';

export default {
  title: 'Axo/AxoTabs',
} satisfies Meta;

export function Basic(): ReactNode {
  const [value, setValue] = useState('1');
  return (
    <AxoTabs.Root value={value} onValueChange={setValue}>
      <AxoTabs.List>
        <AxoTabs.Trigger value="1">One</AxoTabs.Trigger>
        <AxoTabs.Trigger value="2">Two</AxoTabs.Trigger>
        <AxoTabs.Trigger value="3">Three</AxoTabs.Trigger>
      </AxoTabs.List>
      <AxoTabs.Content value="1">One Content</AxoTabs.Content>
      <AxoTabs.Content value="2">Two Content</AxoTabs.Content>
      <AxoTabs.Content value="3">Three Content</AxoTabs.Content>
    </AxoTabs.Root>
  );
}
