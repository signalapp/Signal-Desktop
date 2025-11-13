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
  variant: AxoCheckbox.Variant;
  defaultChecked: boolean;
  disabled?: boolean;
}): JSX.Element {
  const [checked, setChecked] = useState(props.defaultChecked);
  return (
    <label className={tw('my-2 flex items-center gap-2')}>
      <AxoCheckbox.Root
        variant={props.variant}
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
      {AxoCheckbox._getAllCheckboxVariants().map(variant => {
        return (
          <section>
            <Template
              variant={variant}
              label="Unchecked"
              defaultChecked={false}
            />
            <Template variant={variant} label="Checked" defaultChecked />
            <Template
              variant={variant}
              label="Unchecked+Disabled"
              defaultChecked={false}
              disabled
            />
            <Template
              variant={variant}
              label="Checked+Disabled"
              defaultChecked
              disabled
            />
          </section>
        );
      })}
    </>
  );
}
