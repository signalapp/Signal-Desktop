// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { AxoSelect } from './AxoSelect';
import { tw } from './tw';

export default {
  title: 'Axo/AxoSelect',
} satisfies Meta;

function Template(props: {
  disabled?: boolean;
  triggerWidth?: AxoSelect.TriggerWidth;
  triggerVariant: AxoSelect.TriggerVariant;
}) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <AxoSelect.Root
      value={value}
      onValueChange={setValue}
      disabled={props.disabled}
    >
      <AxoSelect.Trigger
        variant={props.triggerVariant}
        width={props.triggerWidth}
        placeholder="Select an item..."
      />
      <AxoSelect.Content>
        <AxoSelect.Group>
          <AxoSelect.Label>Fruits</AxoSelect.Label>
          <AxoSelect.Item value="apple">Apple</AxoSelect.Item>
          <AxoSelect.Item value="banana">Banana</AxoSelect.Item>
          <AxoSelect.Item value="blueberry">Blueberry</AxoSelect.Item>
          <AxoSelect.Item value="grapes">Grapes</AxoSelect.Item>
          <AxoSelect.Item value="pineapple">Pineapple</AxoSelect.Item>
        </AxoSelect.Group>
        <AxoSelect.Separator />
        <AxoSelect.Group>
          <AxoSelect.Label>Vegetables</AxoSelect.Label>
          <AxoSelect.Item value="aubergine">Aubergine</AxoSelect.Item>
          <AxoSelect.Item value="broccoli">Broccoli</AxoSelect.Item>
          <AxoSelect.Item value="carrot" disabled>
            Carrot
          </AxoSelect.Item>
          <AxoSelect.Item value="leek">Leek</AxoSelect.Item>
        </AxoSelect.Group>
        <AxoSelect.Separator />
        <AxoSelect.Group>
          <AxoSelect.Label>Meat</AxoSelect.Label>
          <AxoSelect.Item value="beef">Beef</AxoSelect.Item>
          <AxoSelect.Item value="chicken">Chicken</AxoSelect.Item>
          <AxoSelect.Item value="lamb">Lamb</AxoSelect.Item>
          <AxoSelect.Item value="pork">Pork</AxoSelect.Item>
        </AxoSelect.Group>
      </AxoSelect.Content>
    </AxoSelect.Root>
  );
}

export function Basic(): JSX.Element {
  return (
    <div
      className={tw(
        'flex h-96 w-full flex-col items-center justify-center gap-2'
      )}
    >
      <div className={tw('flex w-full gap-2')}>
        <Template triggerVariant="default" />
        <Template triggerVariant="default" disabled />
      </div>
      <div className={tw('flex w-full gap-2')}>
        <Template triggerVariant="floating" />
        <Template triggerVariant="floating" disabled />
      </div>
      <div className={tw('flex w-full gap-2')}>
        <Template triggerVariant="borderless" />
        <Template triggerVariant="borderless" disabled />
      </div>

      <div className={tw('flex w-full gap-2')}>
        <Template triggerWidth="full" triggerVariant="default" />
        <Template triggerWidth="full" triggerVariant="default" disabled />
      </div>
      <div className={tw('flex w-full gap-2')}>
        <Template triggerWidth="full" triggerVariant="floating" />
        <Template triggerWidth="full" triggerVariant="floating" disabled />
      </div>
      <div className={tw('flex w-full gap-2')}>
        <Template triggerWidth="full" triggerVariant="borderless" />
        <Template triggerWidth="full" triggerVariant="borderless" disabled />
      </div>
    </div>
  );
}
