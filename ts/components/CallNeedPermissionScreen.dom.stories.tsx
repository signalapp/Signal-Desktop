// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { ComponentMeta } from '../storybook/types.std.js';
import type { Props } from './CallNeedPermissionScreen.dom.js';
import { CallNeedPermissionScreen } from './CallNeedPermissionScreen.dom.js';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CallNeedPermissionScreen',
  component: CallNeedPermissionScreen,
  args: {
    i18n,
    close: action('close'),
    conversation: getDefaultConversation(),
  },
} satisfies ComponentMeta<Props>;

export function Default(args: Props): JSX.Element {
  return <CallNeedPermissionScreen {...args} />;
}
