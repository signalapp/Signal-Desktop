// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { AxoCheckbox } from './AxoCheckbox.dom.js';
import { tw } from './tw.dom.js';

export default {
  title: 'Axo/AxoCheckbox',
} satisfies Meta;

function Template(props: {
  label: string;
  defaultChecked: boolean;
  disabled?: boolean;
}): JSX.Element {
  const [checked, setChecked] = useState(props.defaultChecked);
  return (
    <label className={tw('my-2 flex items-center gap-2')}>
      <AxoCheckbox.Root
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
      <h1 className={tw('type-title-large')}>AxoCheckbox</h1>
      <Template label="Unchecked" defaultChecked={false} />
      <Template label="Checked" defaultChecked />
      <Template label="Unchecked+Disabled" defaultChecked={false} disabled />
      <Template label="Checked+Disabled" defaultChecked disabled />
    </>
  );
}
