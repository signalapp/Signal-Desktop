// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import { useCallback, useState, type ReactNode } from 'react';
import { AxoFieldGroup } from './AxoFieldGroup.dom.tsx';
import { AxoTextField } from './AxoTextField.dom.tsx';
import { useTimers } from '../timers.dom.tsx';

export default {
  title: 'Axo/Fields/AxoFieldGroup',
} satisfies Meta;

export function Basic(): ReactNode {
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');

  return (
    <AxoFieldGroup.Root>
      <AxoTextField.Root
        value={givenName}
        onValueChange={setGivenName}
        maxBytes={800}
        maxGraphemes={200}
      >
        <AxoTextField.Input placeholder="Given name" />
      </AxoTextField.Root>
      <AxoFieldGroup.Separator />
      <AxoTextField.Root
        value={familyName}
        onValueChange={setFamilyName}
        maxBytes={800}
        maxGraphemes={200}
      >
        <AxoTextField.Input placeholder="Family name" />
      </AxoTextField.Root>
    </AxoFieldGroup.Root>
  );
}

export function Fit(): ReactNode {
  const [nickname, setNickname] = useState('');
  const [discriminator, setDiscriminator] = useState('');

  return (
    <AxoFieldGroup.Root>
      <AxoTextField.Root
        value={nickname}
        onValueChange={setNickname}
        maxBytes={800}
        maxGraphemes={200}
      >
        <AxoTextField.Input placeholder="Username" />
      </AxoTextField.Root>
      <AxoFieldGroup.Separator />
      <AxoTextField.Root
        value={discriminator}
        onValueChange={setDiscriminator}
        maxBytes={800}
        maxGraphemes={200}
      >
        <AxoTextField.Input placeholder="00" sizing="fit" tabularNums />
      </AxoTextField.Root>
    </AxoFieldGroup.Root>
  );
}

export function KitchenSink(): ReactNode {
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [givenNamePending, setGivenNamePending] = useState(false);
  const [familyNamePending, setFamilyNamePending] = useState(false);
  const givenNameTimers = useTimers();
  const familyNameTimers = useTimers();

  const onGivenNameChange = useCallback(
    (value: string) => {
      setGivenName(value);
      setGivenNamePending(true);
      givenNameTimers.cancelAll();
      givenNameTimers.add(1000, () => {
        setGivenNamePending(false);
      });
    },
    [givenNameTimers]
  );

  const onFamilyNameChange = useCallback(
    (value: string) => {
      setFamilyName(value);
      setFamilyNamePending(true);
      familyNameTimers.cancelAll();
      familyNameTimers.add(1000, () => {
        setFamilyNamePending(false);
      });
    },
    [familyNameTimers]
  );

  return (
    <AxoFieldGroup.Root>
      <AxoTextField.Root
        value={givenName}
        onValueChange={onGivenNameChange}
        maxBytes={64}
        maxGraphemes={16}
      >
        <AxoTextField.Icon symbol="person" />
        <AxoTextField.Input placeholder="Given name" />
        <AxoTextField.Count />
        <AxoTextField.Clear />
        <AxoTextField.LoadingIndicator pending={givenNamePending} />
      </AxoTextField.Root>
      <AxoFieldGroup.Separator />
      <AxoTextField.Root
        value={familyName}
        onValueChange={onFamilyNameChange}
        maxBytes={64}
        maxGraphemes={16}
      >
        <AxoTextField.Icon symbol="group" />
        <AxoTextField.Input placeholder="Family name" />
        <AxoTextField.Count />
        <AxoTextField.Clear />
        <AxoTextField.LoadingIndicator pending={familyNamePending} />
      </AxoTextField.Root>
    </AxoFieldGroup.Root>
  );
}
