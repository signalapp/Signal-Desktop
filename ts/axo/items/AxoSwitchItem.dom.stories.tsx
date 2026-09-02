// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import { useState, type ReactNode } from 'react';
import { AxoSwitchItem } from './AxoSwitchItem.dom.tsx';
import { AxoItem } from './AxoItem.dom.tsx';
import { AxoList } from './AxoList.dom.tsx';

export default {
  title: 'Axo/Items/AxoSwitchItem',
} satisfies Meta;

export function Title(): ReactNode {
  const [checked, setChecked] = useState(false);
  return (
    <AxoItem.Group>
      <AxoSwitchItem.Root
        label="Title"
        checked={checked}
        onCheckedChange={setChecked}
      />
    </AxoItem.Group>
  );
}

export function Description(): ReactNode {
  const [checked, setChecked] = useState(false);
  return (
    <AxoItem.Group>
      <AxoSwitchItem.Root
        label="Title"
        description="Description"
        checked={checked}
        onCheckedChange={setChecked}
      />
    </AxoItem.Group>
  );
}

export function Symbol(): ReactNode {
  const [checked, setChecked] = useState(false);
  return (
    <AxoItem.Group>
      <AxoSwitchItem.Root
        symbol="info-circle"
        label="Title"
        checked={checked}
        onCheckedChange={setChecked}
      />
    </AxoItem.Group>
  );
}

export function List(): ReactNode {
  const [checked, setChecked] = useState(false);
  return (
    <AxoList.Root>
      <AxoList.Body>
        <AxoItem.Group>
          <AxoSwitchItem.Root
            label="Title"
            checked={checked}
            onCheckedChange={setChecked}
          />
          <AxoSwitchItem.Root
            label="Title"
            description="Description"
            checked={checked}
            onCheckedChange={setChecked}
          />
          <AxoSwitchItem.Root
            symbol="info-circle"
            label="Title"
            checked={checked}
            onCheckedChange={setChecked}
          />
        </AxoItem.Group>
      </AxoList.Body>
    </AxoList.Root>
  );
}
