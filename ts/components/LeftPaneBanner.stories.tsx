// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { LeftPaneBanner, type PropsType } from './LeftPaneBanner';

export default {
  title: 'Components/LeftPaneBanner',
  component: LeftPaneBanner,
  argTypes: {
    actionText: { control: { type: 'text' } },
    children: { control: { type: 'text' } },
  },
  args: {
    actionText: 'Fix now',
    children: 'Recoverable issue detected',
    onClick: action('onClick'),
  },
} satisfies Meta<PropsType>;

export function Defaults(args: PropsType): JSX.Element {
  return <LeftPaneBanner {...args} />;
}
