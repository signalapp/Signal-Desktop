// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { AxoSelect } from './AxoSelect.dom.js';
import { tw } from './tw.dom.js';

export default {
  title: 'Axo/AxoSelect',
} satisfies Meta;

function TemplateItem(props: {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <AxoSelect.Item value={props.value} disabled={props.disabled}>
      <AxoSelect.ItemText>{props.children}</AxoSelect.ItemText>
    </AxoSelect.Item>
  );
}

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
          <TemplateItem value="apple">Apple</TemplateItem>
          <TemplateItem value="banana">Banana</TemplateItem>
          <TemplateItem value="blueberry">Blueberry</TemplateItem>
          <TemplateItem value="grapes">Grapes</TemplateItem>
          <TemplateItem value="pineapple">Pineapple</TemplateItem>
        </AxoSelect.Group>
        <AxoSelect.Separator />
        <AxoSelect.Group>
          <AxoSelect.Label>Vegetables</AxoSelect.Label>
          <TemplateItem value="aubergine">Aubergine</TemplateItem>
          <TemplateItem value="broccoli">Broccoli</TemplateItem>
          <TemplateItem value="carrot" disabled>
            Carrot
          </TemplateItem>
          <TemplateItem value="leek">Leek</TemplateItem>
        </AxoSelect.Group>
        <AxoSelect.Separator />
        <AxoSelect.Group>
          <AxoSelect.Label>Meat</AxoSelect.Label>
          <TemplateItem value="beef">Beef</TemplateItem>
          <TemplateItem value="chicken">Chicken</TemplateItem>
          <TemplateItem value="lamb">Lamb</TemplateItem>
          <TemplateItem value="pork">Pork</TemplateItem>
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
