// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { action } from '@storybook/addon-actions';
import React, { useState } from 'react';
import { DonateInputCardNumber } from './DonateInputCardNumber.dom.js';
import type { DonateInputCardNumberProps } from './DonateInputCardNumber.dom.js';
import type { ComponentMeta } from '../../../storybook/types.std.js';

export default {
  component: DonateInputCardNumber,
  args: {
    id: '',
    value: '',
    onValueChange: action('onValueChange'),
    onBlur: action('onBlur'),
    onEnter: action('onEnter'),
    maxInputLength: 19,
  },
} satisfies ComponentMeta<DonateInputCardNumberProps>;

export function Default(props: DonateInputCardNumberProps): JSX.Element {
  const [value, setValue] = useState('');
  return (
    <DonateInputCardNumber {...props} value={value} onValueChange={setValue} />
  );
}
