// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './CircleCheckbox.dom.js';
import { CircleCheckbox, Variant } from './CircleCheckbox.dom.js';

const createProps = (): Props => ({
  checked: false,
  name: 'check-me',
  onChange: action('onChange'),
});

export default {
  title: 'Components/CircleCheckbox',
} satisfies Meta<Props>;

export function Normal(): React.JSX.Element {
  return <CircleCheckbox {...createProps()} />;
}

export function Checked(): React.JSX.Element {
  return <CircleCheckbox {...createProps()} checked />;
}

export function Disabled(): React.JSX.Element {
  return <CircleCheckbox {...createProps()} disabled />;
}

export function SmallNormal(): React.JSX.Element {
  return <CircleCheckbox variant={Variant.Small} {...createProps()} />;
}

export function SmallChecked(): React.JSX.Element {
  return <CircleCheckbox variant={Variant.Small} {...createProps()} checked />;
}

export function SmallDisabled(): React.JSX.Element {
  return <CircleCheckbox variant={Variant.Small} {...createProps()} disabled />;
}

export function RadioNormal(): React.JSX.Element {
  return <CircleCheckbox isRadio {...createProps()} />;
}

export function RadioChecked(): React.JSX.Element {
  return <CircleCheckbox isRadio {...createProps()} checked />;
}

export function RadioDisabled(): React.JSX.Element {
  return <CircleCheckbox isRadio {...createProps()} disabled />;
}

export function SmallRadioNormal(): React.JSX.Element {
  return <CircleCheckbox variant={Variant.Small} isRadio {...createProps()} />;
}

export function SmallRadioChecked(): React.JSX.Element {
  return (
    <CircleCheckbox
      variant={Variant.Small}
      isRadio
      {...createProps()}
      checked
    />
  );
}

export function SmallRadioDisabled(): React.JSX.Element {
  return (
    <CircleCheckbox
      variant={Variant.Small}
      isRadio
      {...createProps()}
      disabled
    />
  );
}
