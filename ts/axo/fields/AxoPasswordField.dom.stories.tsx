// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { AxoPasswordField } from './AxoPasswordField.dom.tsx';

export default {
  title: 'Axo/Fields/AxoPasswordField',
} satisfies Meta;

export function Basic(): ReactNode {
  const [value, setValue] = useState('');
  return (
    <AxoPasswordField.Root
      value={value}
      onValueChange={setValue}
      maxBytes={64}
      maxGraphemes={64}
    >
      <AxoPasswordField.Input
        placeholder="Password"
        autoComplete="current-password"
      />
      <AxoPasswordField.Reveal />
    </AxoPasswordField.Root>
  );
}
