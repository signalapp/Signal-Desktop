// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { PropsType } from './UsernameMegaphone';
import { UsernameMegaphone } from './UsernameMegaphone';
import { type ComponentMeta } from '../storybook/types';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

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
