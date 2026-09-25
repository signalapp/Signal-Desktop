// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import { useState, type ReactNode } from 'react';
import { AxoFieldList } from './AxoFieldList.dom.tsx';
import { AxoTextField } from '../fields/AxoTextField.dom.tsx';
import { AxoFieldGroup } from '../fields/AxoFieldGroup.dom.tsx';

export default {
  title: 'Axo/Items/AxoFieldList',
} satisfies Meta;

function GivenName() {
  const [value, setValue] = useState('');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={setValue}
      maxGraphemes={26}
      maxBytes={128}
    >
      <AxoTextField.Input placeholder="First name (Required)" />
      <AxoTextField.Count />
      <AxoTextField.Clear />
    </AxoTextField.Root>
  );
}

function FamilyName() {
  const [value, setValue] = useState('');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={setValue}
      maxGraphemes={26}
      maxBytes={128}
    >
      <AxoTextField.Input placeholder="Last name (Optional)" />
      <AxoTextField.Count />
      <AxoTextField.Clear />
    </AxoTextField.Root>
  );
}

export function Basic(): ReactNode {
  return (
    <AxoFieldList.Root>
      <AxoFieldList.Item>
        <GivenName />
      </AxoFieldList.Item>
      <AxoFieldList.Item>
        <FamilyName />
      </AxoFieldList.Item>
    </AxoFieldList.Root>
  );
}

export function Title(): ReactNode {
  return (
    <AxoFieldList.Root title="Profile">
      <AxoFieldList.Item>
        <GivenName />
      </AxoFieldList.Item>
      <AxoFieldList.Item>
        <FamilyName />
      </AxoFieldList.Item>
    </AxoFieldList.Root>
  );
}

export function Description(): ReactNode {
  return (
    <AxoFieldList.Root
      title="Profile"
      description="Your profile and changes to it will be visible to people you message, contacts and groups."
    >
      <AxoFieldList.Item>
        <GivenName />
      </AxoFieldList.Item>
      <AxoFieldList.Item>
        <FamilyName />
      </AxoFieldList.Item>
    </AxoFieldList.Root>
  );
}

export function Help(): ReactNode {
  return (
    <AxoFieldList.Root
      title="Profile"
      footerDescription="Your profile and changes to it will be visible to people you message, contacts and groups."
    >
      <AxoFieldList.Item>
        <GivenName />
      </AxoFieldList.Item>
      <AxoFieldList.Item>
        <FamilyName />
      </AxoFieldList.Item>
    </AxoFieldList.Root>
  );
}

export function Group(): ReactNode {
  return (
    <AxoFieldList.Root title="Profile">
      <AxoFieldList.Item>
        <AxoFieldGroup.Root>
          <GivenName />
          <AxoFieldGroup.Separator />
          <FamilyName />
        </AxoFieldGroup.Root>
      </AxoFieldList.Item>
    </AxoFieldList.Root>
  );
}
