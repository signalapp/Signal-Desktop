// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta, Story } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './ScrollDownButton';
import { ScrollDownButton } from './ScrollDownButton';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  scrollDown: action('scrollDown'),
  conversationId: 'fake-conversation-id',
  ...overrideProps,
});

export default {
  title: 'Components/Conversation/ScrollDownButton',
  component: ScrollDownButton,
  argTypes: {
    unreadCount: {
      control: { type: 'radio' },
      options: {
        None: undefined,
        Some: 5,
        Plenty: 85,
        'Please Stop': 1000,
      },
    },
  },
} as Meta;

const Template: Story<Props> = args => <ScrollDownButton {...args} />;

export const Default = Template.bind({});
Default.args = createProps({});
Default.story = {
  name: 'Default',
};
