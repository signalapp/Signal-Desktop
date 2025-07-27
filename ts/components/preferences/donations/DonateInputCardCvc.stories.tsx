// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { action } from '@storybook/addon-actions';
import React, { useState } from 'react';
import { DonateInputCardCvc } from './DonateInputCardCvc';
import type { DonateInputCardCvcProps } from './DonateInputCardCvc';
import type { ComponentMeta } from '../../../storybook/types';

export default {
  component: DonateInputCardCvc,
  args: {
    id: '',
    value: '',
    onValueChange: action('onValueChange'),
    maxInputLength: 3,
    onBlur: action('onBlur'),
  },
} satisfies ComponentMeta<DonateInputCardCvcProps>;

export function Default(props: DonateInputCardCvcProps): JSX.Element {
  const [value, setValue] = useState('');
  return (
    <DonateInputCardCvc {...props} value={value} onValueChange={setValue} />
  );
}
