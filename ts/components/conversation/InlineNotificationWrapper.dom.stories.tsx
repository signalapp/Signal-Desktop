// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { Meta } from '@storybook/react';

import { InlineNotificationWrapper } from './InlineNotificationWrapper.dom.js';
import { action } from '@storybook/addon-actions';
import { tw } from '../../axo/tw.dom.js';

import type { Props } from './InlineNotificationWrapper.dom.js';

export default {
  title: 'Components/Conversation/InlineNotificationWrapper',
  args: {
    conversationId: 'cId1',
    isTargeted: false,
    isSelected: false,
    targetMessage: action('targetMessage'),
    toggleSelectMessage: action('toggleSelectMessage'),
    children: (
      <div className={tw('p-2.5 text-center')}>
        This is the default contents
      </div>
    ),
  },
} satisfies Meta<Props>;

export function Default(args: Props): React.JSX.Element {
  return <InlineNotificationWrapper {...args} />;
}

export function SelectMode(args: Props): React.JSX.Element {
  return <InlineNotificationWrapper {...args} isSelectMode />;
}

export function SelectModeAndSelected(args: Props): React.JSX.Element {
  return <InlineNotificationWrapper {...args} isSelectMode isSelected />;
}
