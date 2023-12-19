// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './CircleCheckbox';
import { CircleCheckbox, Variant } from './CircleCheckbox';

const createProps = (): Props => ({
  checked: false,
  name: 'check-me',
  onChange: action('onChange'),
});

export default {
  title: 'Components/CircleCheckbox',
} satisfies Meta<Props>;

export function Normal(): JSX.Element {
  return <CircleCheckbox {...createProps()} />;
}

export function Checked(): JSX.Element {
  return <CircleCheckbox {...createProps()} checked />;
}

export function Disabled(): JSX.Element {
  return <CircleCheckbox {...createProps()} disabled />;
}

export function SmallNormal(): JSX.Element {
  return <CircleCheckbox variant={Variant.Small} {...createProps()} />;
}

export function SmallChecked(): JSX.Element {
  return <CircleCheckbox variant={Variant.Small} {...createProps()} checked />;
}

export function SmallDisabled(): JSX.Element {
  return <CircleCheckbox variant={Variant.Small} {...createProps()} disabled />;
}

export function RadioNormal(): JSX.Element {
  return <CircleCheckbox isRadio {...createProps()} />;
}

export function RadioChecked(): JSX.Element {
  return <CircleCheckbox isRadio {...createProps()} checked />;
}

export function RadioDisabled(): JSX.Element {
  return <CircleCheckbox isRadio {...createProps()} disabled />;
}

export function SmallRadioNormal(): JSX.Element {
  return <CircleCheckbox variant={Variant.Small} isRadio {...createProps()} />;
}

export function SmallRadioChecked(): JSX.Element {
  return (
    <CircleCheckbox
      variant={Variant.Small}
      isRadio
      {...createProps()}
      checked
    />
  );
}

export function SmallRadioDisabled(): JSX.Element {
  return (
    <CircleCheckbox
      variant={Variant.Small}
      isRadio
      {...createProps()}
      disabled
    />
  );
}
