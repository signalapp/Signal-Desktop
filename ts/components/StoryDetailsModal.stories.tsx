// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';
import casual from 'casual';

import type { PropsType } from './StoryDetailsModal';
import enMessages from '../../_locales/en/messages.json';
import { SendStatus } from '../messages/MessageSendState';
import { StoryDetailsModal } from './StoryDetailsModal';
import { fakeAttachment } from '../test-both/helpers/fakeAttachment';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/StoryDetailsModal',
  component: StoryDetailsModal,
  argTypes: {
    getPreferredBadge: { action: true },
    i18n: {
      defaultValue: i18n,
    },
    onClose: { action: true },
    sender: {
      defaultValue: getDefaultConversation(),
    },
    sendState: {
      defaultValue: undefined,
    },
    size: {
      defaultValue: fakeAttachment().size,
    },
    timestamp: {
      defaultValue: Date.now(),
    },
  },
} as Meta;

const Template: Story<PropsType> = args => <StoryDetailsModal {...args} />;

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
