// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { action } from '@storybook/addon-actions';
import React, { useState } from 'react';
import { DonateInputCardExp } from './DonateInputCardExp';
import type { DonateInputCardExpProps } from './DonateInputCardExp';
import type { ComponentMeta } from '../../../storybook/types';

export default {
  component: DonateInputCardExp,
  args: {
    id: '',
    value: '',
    onValueChange: action('onValueChange'),
    onBlur: action('onBlur'),
  },
} satisfies ComponentMeta<DonateInputCardExpProps>;

export function Default(props: DonateInputCardExpProps): JSX.Element {
  const [value, setValue] = useState('');
  return (
    <DonateInputCardExp {...props} value={value} onValueChange={setValue} />
  );
}
