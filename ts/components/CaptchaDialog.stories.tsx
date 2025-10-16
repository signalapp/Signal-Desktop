// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './CaptchaDialog.dom.js';
import { CaptchaDialog } from './CaptchaDialog.dom.js';
import { Button } from './Button.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CaptchaDialog',
  argTypes: {
    isPending: { control: { type: 'boolean' } },
  },
  args: {
    i18n,
    isPending: false,
    onContinue: action('onContinue'),
  },
} satisfies Meta<PropsType>;

export function Basic(args: PropsType): JSX.Element {
  const [isSkipped, setIsSkipped] = useState(false);

  if (isSkipped) {
    return <Button onClick={() => setIsSkipped(false)}>Show again</Button>;
  }

  return <CaptchaDialog {...args} onSkip={() => setIsSkipped(true)} />;
}
