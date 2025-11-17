// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { AxoRadioGroup } from './AxoRadioGroup.dom.js';

export default {
  title: 'Axo/AxoRadioGroup',
} satisfies Meta;

export function Default(): JSX.Element {
  const [value, setValue] = useState('foo');
  return (
    <AxoRadioGroup.Root value={value} onValueChange={setValue}>
      <AxoRadioGroup.Item value="foo">
        <AxoRadioGroup.Indicator />
        <AxoRadioGroup.Label>Foo</AxoRadioGroup.Label>
      </AxoRadioGroup.Item>
      <AxoRadioGroup.Item value="bar">
        <AxoRadioGroup.Indicator />
        <AxoRadioGroup.Label>Bar</AxoRadioGroup.Label>
      </AxoRadioGroup.Item>
      <AxoRadioGroup.Item value="baz">
        <AxoRadioGroup.Indicator />
        <AxoRadioGroup.Label>
          Lorem ipsum dolor, sit amet consectetur adipisicing elit. Veniam
          accusantium a aperiam quas perferendis error velit ipsam animi natus
          deserunt iste voluptatem asperiores voluptates rem odio necessitatibus
          delectus, optio officia?
        </AxoRadioGroup.Label>
      </AxoRadioGroup.Item>
    </AxoRadioGroup.Root>
  );
}
