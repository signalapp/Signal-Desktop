// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';

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
};

export const Normal = (): JSX.Element => <Checkbox {...createProps()} />;
export const Checked = (): JSX.Element => (
  <Checkbox {...createProps()} checked />
);

export const Description = (): JSX.Element => (
  <Checkbox {...createProps()} description="This is a checkbox" />
);

export const Disabled = (): JSX.Element => (
  <Checkbox {...createProps()} disabled />
);
