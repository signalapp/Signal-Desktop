// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { AxoSearchField } from './AxoSearchField.dom.tsx';

export default {
  title: 'Axo/Fields/AxoSearchField',
} satisfies Meta;

export function Basic(): ReactNode {
  const [value, setValue] = useState('');
  return (
    <AxoSearchField.Root
      width="lg"
      value={value}
      onValueChange={setValue}
      placeholder="Search"
    />
  );
}
