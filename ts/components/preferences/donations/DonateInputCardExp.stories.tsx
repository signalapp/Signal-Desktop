// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { action } from '@storybook/addon-actions';
import React, { useState } from 'react';
import { DonateInputCardExp } from './DonateInputCardExp.dom.js';
import type { DonateInputCardExpProps } from './DonateInputCardExp.dom.js';
import type { ComponentMeta } from '../../../storybook/types.std.js';

const { i18n } = window.SignalContext;

export default {
  component: DonateInputCardExp,
  args: {
    i18n,
    id: '',
    value: '',
    onValueChange: action('onValueChange'),
    onBlur: action('onBlur'),
    onEnter: action('onEnter'),
  },
} satisfies ComponentMeta<DonateInputCardExpProps>;

export function Default(props: DonateInputCardExpProps): JSX.Element {
  const [value, setValue] = useState('');
  return (
    <DonateInputCardExp {...props} value={value} onValueChange={setValue} />
  );
}
