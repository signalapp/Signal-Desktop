// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './Checkbox';
import { Checkbox } from './Checkbox';

const createProps = (): PropsType => ({
  checked: false,
  label: 'Check Me!',
  name: 'check-me',
  onChange: action('onChange'),
});

export default {
  title: 'Components/Checkbox',
} satisfies Meta<PropsType>;

export function Normal(): JSX.Element {
  return <Checkbox {...createProps()} />;
}
export function Checked(): JSX.Element {
  return <Checkbox {...createProps()} checked />;
}

export function Description(): JSX.Element {
  return <Checkbox {...createProps()} description="This is a checkbox" />;
}

export function Disabled(): JSX.Element {
  return <Checkbox {...createProps()} disabled />;
}
