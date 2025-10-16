// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { AxoSwitch } from './AxoSwitch.dom.js';
import { tw } from './tw.dom.js';

export default {
  title: 'Axo/AxoSwitch',
} satisfies Meta;

function Template(props: {
  label: string;
  defaultChecked: boolean;
  disabled?: boolean;
}): JSX.Element {
  const [checked, setChecked] = useState(props.defaultChecked);
  return (
    <label className={tw('my-2 flex items-center gap-2')}>
      <AxoSwitch.Root
        checked={checked}
        onCheckedChange={setChecked}
        disabled={props.disabled}
      />
      {props.label}
    </label>
  );
}

export function Basic(): JSX.Element {
  return (
    <>
      <h1 className={tw('type-title-large')}>AxoSwitch</h1>
      <Template label="Unchecked" defaultChecked={false} />
      <Template label="Checked" defaultChecked />
      <Template label="UncheckedDisabled" defaultChecked={false} disabled />
      <Template label="CheckedDisabled" defaultChecked disabled />
    </>
  );
}
