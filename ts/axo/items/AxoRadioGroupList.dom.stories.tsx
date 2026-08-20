// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { AxoRadioGroupList } from './AxoRadioGroupList.dom.tsx';

export default {
  title: 'Axo/Items/AxoRadioGroupList',
} satisfies Meta;

export function Basic(): ReactNode {
  const [value, setValue] = useState('1');
  return (
    <AxoRadioGroupList.Root value={value} onValueChange={setValue}>
      <AxoRadioGroupList.Item value="1">
        <AxoRadioGroupList.Label>One</AxoRadioGroupList.Label>
      </AxoRadioGroupList.Item>
      <AxoRadioGroupList.Item value="2">
        <AxoRadioGroupList.Label>Two</AxoRadioGroupList.Label>
      </AxoRadioGroupList.Item>
      <AxoRadioGroupList.Item value="3">
        <AxoRadioGroupList.Label>Three</AxoRadioGroupList.Label>
      </AxoRadioGroupList.Item>
    </AxoRadioGroupList.Root>
  );
}

export function Descriptions(): ReactNode {
  const [value, setValue] = useState('1');
  return (
    <AxoRadioGroupList.Root value={value} onValueChange={setValue}>
      <AxoRadioGroupList.Item value="1">
        <AxoRadioGroupList.Label>One</AxoRadioGroupList.Label>
        <AxoRadioGroupList.Description>
          Lorem ipsum dolor, sit amet consectetur adipisicing elit.
        </AxoRadioGroupList.Description>
      </AxoRadioGroupList.Item>
      <AxoRadioGroupList.Item value="2">
        <AxoRadioGroupList.Label>Two</AxoRadioGroupList.Label>
        <AxoRadioGroupList.Description>
          Lorem ipsum dolor, sit amet consectetur adipisicing elit.
        </AxoRadioGroupList.Description>
      </AxoRadioGroupList.Item>
      <AxoRadioGroupList.Item value="3">
        <AxoRadioGroupList.Label>Three</AxoRadioGroupList.Label>
        <AxoRadioGroupList.Description>
          Lorem ipsum dolor, sit amet consectetur adipisicing elit.
        </AxoRadioGroupList.Description>
      </AxoRadioGroupList.Item>
    </AxoRadioGroupList.Root>
  );
}
