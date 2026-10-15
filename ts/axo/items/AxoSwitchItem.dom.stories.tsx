// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
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

export const LabelActivation: StoryObj = {
  render: () => <Title />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole('switch', { name: 'Title' });

    await expect(control).not.toBeChecked();
    await userEvent.click(canvas.getByText('Title'));
    await expect(control).toBeChecked();

    await userEvent.click(control);
    await expect(control).not.toBeChecked();

    control.focus();
    await userEvent.keyboard(' ');
    await expect(control).toBeChecked();
  },
};

export const IndependentLabels: StoryObj = {
  render: function Render() {
    const [firstChecked, setFirstChecked] = useState(false);
    const [secondChecked, setSecondChecked] = useState(false);
    return (
      <AxoItem.Group>
        <AxoSwitchItem.Root
          label={<span>First setting</span>}
          checked={firstChecked}
          onCheckedChange={setFirstChecked}
        />
        <AxoSwitchItem.Root
          label="Second setting"
          checked={secondChecked}
          onCheckedChange={setSecondChecked}
        />
      </AxoItem.Group>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole('switch', { name: 'First setting' });
    const second = canvas.getByRole('switch', { name: 'Second setting' });

    await userEvent.click(canvas.getByText('First setting'));
    await expect(first).toBeChecked();
    await expect(second).not.toBeChecked();

    await userEvent.click(canvas.getByText('Second setting'));
    await expect(first).toBeChecked();
    await expect(second).toBeChecked();
  },
};

export const DisabledLabels: StoryObj = {
  render: function Render() {
    const [unchecked, setUnchecked] = useState(false);
    const [checked, setChecked] = useState(true);
    return (
      <AxoItem.Group>
        <AxoSwitchItem.Root
          label="Disabled unchecked"
          disabled
          checked={unchecked}
          onCheckedChange={setUnchecked}
        />
        <AxoSwitchItem.Root
          label="Disabled checked"
          tooltip="This setting is unavailable"
          disabled
          checked={checked}
          onCheckedChange={setChecked}
        />
      </AxoItem.Group>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const unchecked = canvas.getByRole('switch', {
      name: 'Disabled unchecked',
    });
    const checked = canvas.getByRole('switch', { name: 'Disabled checked' });

    await userEvent.click(canvas.getByText('Disabled unchecked'));
    await expect(unchecked).not.toBeChecked();
    await userEvent.click(unchecked);
    await expect(unchecked).not.toBeChecked();
    unchecked.focus();
    await userEvent.keyboard(' ');
    await expect(unchecked).not.toBeChecked();

    await userEvent.click(canvas.getByText('Disabled checked'));
    await expect(checked).toBeChecked();
    await userEvent.click(checked);
    await expect(checked).toBeChecked();
    checked.focus();
    await userEvent.keyboard(' ');
    await expect(checked).toBeChecked();
  },
};
