// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import { useState, type ReactNode } from 'react';
import { AxoSelectItem } from './AxoSelectItem.dom.tsx';
import { AxoItem } from './AxoItem.dom.tsx';

export default {
  title: 'Axo/Items/AxoSelectItem',
} satisfies Meta;

export function Basic(): ReactNode {
  const [value, setValue] = useState<string | null>(null);
  return (
    <AxoItem.Group>
      <AxoSelectItem.Root
        label="Title"
        placeholder="Placeholder"
        value={value}
        onValueChange={setValue}
        options={[
          { label: 'One', value: '1' },
          { label: 'Two', value: '2' },
          { label: 'Three', value: '3' },
        ]}
      />
    </AxoItem.Group>
  );
}

export function Description(): ReactNode {
  const [value, setValue] = useState<string | null>(null);
  return (
    <AxoItem.Group>
      <AxoSelectItem.Root
        label="Title"
        description="Description"
        placeholder="Placeholder"
        value={value}
        onValueChange={setValue}
        options={[
          { label: 'One', value: '1' },
          { label: 'Two', value: '2' },
          { label: 'Three', value: '3' },
        ]}
      />
    </AxoItem.Group>
  );
}

export function Icon(): ReactNode {
  const [value, setValue] = useState<string | null>(null);
  return (
    <AxoItem.Group>
      <AxoSelectItem.Root
        symbol="settings"
        label="Title"
        placeholder="Placeholder"
        value={value}
        onValueChange={setValue}
        options={[
          { label: 'One', value: '1' },
          { label: 'Two', value: '2' },
          { label: 'Three', value: '3' },
        ]}
      />
    </AxoItem.Group>
  );
}
