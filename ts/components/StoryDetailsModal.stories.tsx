// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import casual from 'casual';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './StoryDetailsModal';
import enMessages from '../../_locales/en/messages.json';
import { SendStatus } from '../messages/MessageSendState';
import { StoryDetailsModal } from './StoryDetailsModal';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/StoryDetailsModal',
  component: StoryDetailsModal,
  args: {
    getPreferredBadge: () => undefined,
    i18n,
    onClose: action('onClose'),
    sender: getDefaultConversation(),
    sendState: undefined,
    timestamp: Date.now(),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => <StoryDetailsModal {...args} />;

export const MyStory = Template.bind({});
MyStory.args = {
  sendState: [
    {
      recipient: getDefaultConversation(),
      status: SendStatus.Delivered,
      updatedAt: casual.unix_time,
    },
    {
      recipient: getDefaultConversation(),
      status: SendStatus.Delivered,
      updatedAt: casual.unix_time,
    },
    {
      recipient: getDefaultConversation(),
      status: SendStatus.Delivered,
      updatedAt: casual.unix_time,
    },
    {
      recipient: getDefaultConversation(),
      status: SendStatus.Delivered,
      updatedAt: casual.unix_time,
    },
    {
      recipient: getDefaultConversation(),
      status: SendStatus.Sent,
      updatedAt: casual.unix_time,
    },
    {
      recipient: getDefaultConversation(),
      status: SendStatus.Viewed,
      updatedAt: casual.unix_time,
    },
    {
      recipient: getDefaultConversation(),
      status: SendStatus.Viewed,
      updatedAt: casual.unix_time,
    },
    {
      recipient: getDefaultConversation(),
      status: SendStatus.Viewed,
      updatedAt: casual.unix_time,
    },
  ],
};

export const OtherStory = Template.bind({});
OtherStory.args = {};
