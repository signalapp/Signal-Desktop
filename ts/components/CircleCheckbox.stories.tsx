// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';

import type { Props } from './CircleCheckbox';
import { CircleCheckbox } from './CircleCheckbox';

const createProps = (): Props => ({
  checked: false,
  name: 'check-me',
  onChange: action('onChange'),
});

export default {
  title: 'Components/CircleCheckbox',
};

export function Normal(): JSX.Element {
  return <CircleCheckbox {...createProps()} />;
}

export function Checked(): JSX.Element {
  return <CircleCheckbox {...createProps()} checked />;
}

export function Disabled(): JSX.Element {
  return <CircleCheckbox {...createProps()} disabled />;
}
