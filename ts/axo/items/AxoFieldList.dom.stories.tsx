// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import { useState, type ReactNode } from 'react';
import { AxoFieldList } from './AxoFieldList.dom.tsx';

export default {
  title: 'Axo/Items/AxoFieldList',
} satisfies Meta;

function Names() {
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');

  return (
    <>
      <AxoFieldList.TextFieldItem
        value={givenName}
        onValueChange={setGivenName}
        placeholder="First name (Required)"
        maxGraphemes={26}
        maxBytes={128}
        showCount
        showClear
      />
      <AxoFieldList.TextFieldItem
        value={familyName}
        onValueChange={setFamilyName}
        placeholder="Last name (Optional)"
        maxGraphemes={26}
        maxBytes={128}
        showCount
        showClear
      />
    </>
  );
}

export function Basic(): ReactNode {
  return (
    <AxoFieldList.Root>
      <Names />
    </AxoFieldList.Root>
  );
}

export function Title(): ReactNode {
  return (
    <AxoFieldList.Root title="Profile">
      <Names />
    </AxoFieldList.Root>
  );
}

export function Description(): ReactNode {
  return (
    <AxoFieldList.Root
      title="Profile"
      description="Your profile and changes to it will be visible to people you message, contacts and groups."
    >
      <Names />
    </AxoFieldList.Root>
  );
}

export function Help(): ReactNode {
  return (
    <AxoFieldList.Root
      title="Profile"
      help="Your profile and changes to it will be visible to people you message, contacts and groups."
    >
      <Names />
    </AxoFieldList.Root>
  );
}
