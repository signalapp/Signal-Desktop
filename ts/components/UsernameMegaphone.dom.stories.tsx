// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { PropsType } from './UsernameMegaphone.dom.js';
import { UsernameMegaphone } from './UsernameMegaphone.dom.js';
import { type ComponentMeta } from '../storybook/types.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/UsernameMegaphone',
  component: UsernameMegaphone,
  argTypes: {},
  args: {
    i18n,
    onLearnMore: action('onLearnMore'),
    onDismiss: action('onDismiss'),
  },
} satisfies ComponentMeta<PropsType>;

export function Defaults(args: PropsType): JSX.Element {
  return <UsernameMegaphone {...args} />;
}
