// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';

import type { PropsType } from './Checkbox';
import { Checkbox } from './Checkbox';

const createProps = (): PropsType => ({
  checked: false,
  label: 'Check Me!',
  name: 'check-me',
  onChange: action('onChange'),
});

const story = storiesOf('Components/Checkbox', module);

story.add('Normal', () => <Checkbox {...createProps()} />);

story.add('Checked', () => <Checkbox {...createProps()} checked />);

story.add('Description', () => (
  <Checkbox {...createProps()} description="This is a checkbox" />
));

story.add('Disabled', () => <Checkbox {...createProps()} disabled />);
