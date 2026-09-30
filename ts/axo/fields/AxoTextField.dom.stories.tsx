// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { Meta } from '@storybook/react';
import { AxoTextField } from './AxoTextField.dom.tsx';
import { Story } from '../_storybook-helpers/Story.dom.tsx';

export default {
  title: 'Axo/Fields/AxoTextField',
} satisfies Meta;

export function Basic(): ReactNode {
  const [value, setValue] = useState('');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={setValue}
      maxBytes={800}
      maxGraphemes={200}
    >
      <AxoTextField.Input placeholder="Placeholder" />
    </AxoTextField.Root>
  );
}

export function Icon(): ReactNode {
  const [value, setValue] = useState('Typed text');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={setValue}
      maxBytes={800}
      maxGraphemes={200}
    >
      <AxoTextField.Icon symbol="label" />
      <AxoTextField.Input placeholder="Placeholder" />
    </AxoTextField.Root>
  );
}

export function Clear(): ReactNode {
  const [value, setValue] = useState('Typed text');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={setValue}
      maxBytes={800}
      maxGraphemes={200}
    >
      <AxoTextField.Icon symbol="label" />
      <AxoTextField.TextArea placeholder="Placeholder" />
      <AxoTextField.Clear />
    </AxoTextField.Root>
  );
}

export function Count(): ReactNode {
  const [value, setValue] = useState('Typed text');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={setValue}
      maxBytes={64}
      maxGraphemes={16}
    >
      <AxoTextField.Icon symbol="label" />
      <AxoTextField.Input placeholder="Placeholder" />
      <AxoTextField.Count />
    </AxoTextField.Root>
  );
}

export function TextArea(): ReactNode {
  const [value, setValue] = useState('Typed text\ncan be\nmultiline');
  return (
    <Story.Stack>
      <AxoTextField.Root
        value={value}
        onValueChange={setValue}
        maxBytes={800}
        maxGraphemes={200}
      >
        <AxoTextField.TextArea placeholder="Placeholder" />
      </AxoTextField.Root>
      <AxoTextField.Root
        value={value}
        onValueChange={setValue}
        maxBytes={128}
        maxGraphemes={32}
      >
        <AxoTextField.Icon symbol="label" />
        <AxoTextField.TextArea placeholder="Placeholder" />
        <AxoTextField.Count />
        <AxoTextField.Clear />
        <AxoTextField.ValidationError>
          This field has an error.
        </AxoTextField.ValidationError>
      </AxoTextField.Root>
    </Story.Stack>
  );
}

export function Action(): ReactNode {
  const [value, setValue] = useState('Typed text');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={setValue}
      maxBytes={800}
      maxGraphemes={200}
    >
      <AxoTextField.Icon symbol="label" />
      <AxoTextField.Input placeholder="Placeholder" />
      <AxoTextField.Action label="More actions" symbol="more" />
    </AxoTextField.Root>
  );
}

export function LeadingAction(): ReactNode {
  const [value, setValue] = useState('Typed text');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={setValue}
      maxBytes={800}
      maxGraphemes={200}
    >
      <AxoTextField.Input placeholder="Placeholder" />
      <AxoTextField.Action slot="leading" label="More actions" symbol="more" />
    </AxoTextField.Root>
  );
}

export function LeadingAndTrailingActions(): ReactNode {
  const [value, setValue] = useState('Typed text');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={setValue}
      maxBytes={800}
      maxGraphemes={200}
    >
      <AxoTextField.Input placeholder="Placeholder" />
      <AxoTextField.Action
        slot="leading"
        label="Pick emoji"
        symbol="face-smiling"
      />
      <AxoTextField.Action slot="trailing" label="More actions" symbol="more" />
    </AxoTextField.Root>
  );
}

export function Disabled(): ReactNode {
  const [value, setValue] = useState('Typed text');
  return (
    <Story.Stack>
      <AxoTextField.Root
        value={value}
        onValueChange={setValue}
        maxBytes={800}
        maxGraphemes={200}
        disabled
      >
        <AxoTextField.Input placeholder="Placeholder" />
      </AxoTextField.Root>

      <AxoTextField.Root
        value={value}
        onValueChange={setValue}
        maxBytes={800}
        maxGraphemes={200}
        disabled
      >
        <AxoTextField.Icon symbol="label" />
        <AxoTextField.Input placeholder="Placeholder" />
        <AxoTextField.Clear />
        <AxoTextField.Count />
        <AxoTextField.Action label="More actions" symbol="more" />
      </AxoTextField.Root>
    </Story.Stack>
  );
}

export function ReadOnly(): ReactNode {
  const [value, setValue] = useState('Typed text');
  return (
    <Story.Stack>
      <AxoTextField.Root
        value={value}
        onValueChange={setValue}
        maxBytes={800}
        maxGraphemes={200}
        readOnly
      >
        <AxoTextField.Input placeholder="Placeholder" />
      </AxoTextField.Root>

      <AxoTextField.Root
        value={value}
        onValueChange={setValue}
        maxBytes={800}
        maxGraphemes={200}
        readOnly
      >
        <AxoTextField.Icon symbol="label" />
        <AxoTextField.Input placeholder="Placeholder" />
        <AxoTextField.Clear />
        <AxoTextField.Count />
        <AxoTextField.Action label="More actions" symbol="more" />
      </AxoTextField.Root>
    </Story.Stack>
  );
}

export function LoadingIndicator(): ReactNode {
  const [value, setValue] = useState('Typed text');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={setValue}
      maxBytes={800}
      maxGraphemes={200}
    >
      <AxoTextField.Input placeholder="Placeholder" />
      <AxoTextField.LoadingIndicator pending />
    </AxoTextField.Root>
  );
}

export function LeadingSlots(): ReactNode {
  const [value, setValue] = useState('');
  return (
    <>
      <Story.Legend label="Icon">
        <AxoTextField.Root
          value={value}
          onValueChange={setValue}
          maxBytes={800}
          maxGraphemes={200}
        >
          <AxoTextField.Icon symbol="label" />
          <AxoTextField.Input placeholder="Placeholder" />
        </AxoTextField.Root>
      </Story.Legend>

      <Story.Legend label="Leading Action">
        <AxoTextField.Root
          value={value}
          onValueChange={setValue}
          maxBytes={800}
          maxGraphemes={200}
        >
          <AxoTextField.Input placeholder="Placeholder" />
          <AxoTextField.Action
            slot="leading"
            label="More actions"
            symbol="more"
          />
        </AxoTextField.Root>
      </Story.Legend>

      <Story.Legend label="Icon + Leading Action">
        <AxoTextField.Root
          value={value}
          onValueChange={setValue}
          maxBytes={800}
          maxGraphemes={200}
        >
          <AxoTextField.Icon symbol="label" />
          <AxoTextField.Input placeholder="Placeholder" />
          <AxoTextField.Action
            slot="leading"
            label="More actions"
            symbol="more"
          />
        </AxoTextField.Root>
        <Story.Hint>Rendering a leading action will hide the icon</Story.Hint>
      </Story.Legend>
    </>
  );
}

export function TrailingSlots(): ReactNode {
  const [value, setValue] = useState('');
  return (
    <>
      <Story.Legend label="Clear">
        <AxoTextField.Root
          value={value}
          onValueChange={setValue}
          maxBytes={800}
          maxGraphemes={200}
        >
          <AxoTextField.Input placeholder="Placeholder" />
          <AxoTextField.Clear forceShow />
        </AxoTextField.Root>
      </Story.Legend>

      <Story.Legend label="Trailing Action">
        <AxoTextField.Root
          value={value}
          onValueChange={setValue}
          maxBytes={800}
          maxGraphemes={200}
        >
          <AxoTextField.Input placeholder="Placeholder" />
          <AxoTextField.Action
            slot="trailing"
            label="More actions"
            symbol="more"
          />
        </AxoTextField.Root>
      </Story.Legend>

      <Story.Legend label="Loading Indicator (Pending)">
        <AxoTextField.Root
          value={value}
          onValueChange={setValue}
          maxBytes={800}
          maxGraphemes={200}
        >
          <AxoTextField.Input placeholder="Placeholder" />
          <AxoTextField.LoadingIndicator pending />
        </AxoTextField.Root>
      </Story.Legend>

      <Story.Legend label="Clear + Trailing Action">
        <AxoTextField.Root
          value={value}
          onValueChange={setValue}
          maxBytes={800}
          maxGraphemes={200}
        >
          <AxoTextField.Input placeholder="Placeholder" />
          <AxoTextField.Clear forceShow />
          <AxoTextField.Action
            slot="trailing"
            label="More actions"
            symbol="more"
          />
        </AxoTextField.Root>
        <Story.Hint>
          Rendering a trailing action will hide the clear button
        </Story.Hint>
      </Story.Legend>

      <Story.Legend label="Clear + Trailing Action + Loading Indicator (Pending)">
        <AxoTextField.Root
          value={value}
          onValueChange={setValue}
          maxBytes={800}
          maxGraphemes={200}
        >
          <AxoTextField.Input placeholder="Placeholder" />
          <AxoTextField.Clear forceShow />
          <AxoTextField.Action
            slot="trailing"
            label="More actions"
            symbol="more"
          />
          <AxoTextField.LoadingIndicator pending />
        </AxoTextField.Root>
        <Story.Hint>
          Rendering a pending loading indicator will hide the trailing action
          and the clear button
        </Story.Hint>
      </Story.Legend>

      <Story.Legend label="Clear + Trailing Action + Loading Indicator (Not Pending)">
        <AxoTextField.Root
          value={value}
          onValueChange={setValue}
          maxBytes={800}
          maxGraphemes={200}
        >
          <AxoTextField.Input placeholder="Placeholder" />
          <AxoTextField.Clear forceShow />
          <AxoTextField.Action
            slot="trailing"
            label="More actions"
            symbol="more"
          />
          <AxoTextField.LoadingIndicator pending={false} />
        </AxoTextField.Root>
        <Story.Hint>
          If the loading indicator is not visible, it will not hide other
          trailing items.
        </Story.Hint>
      </Story.Legend>
    </>
  );
}

export function Error(): ReactNode {
  const [value, setValue] = useState('');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={setValue}
      maxBytes={800}
      maxGraphemes={200}
    >
      <AxoTextField.Input placeholder="Placeholder" required />
      <AxoTextField.ValidationError>
        This is an error message.
      </AxoTextField.ValidationError>
    </AxoTextField.Root>
  );
}
