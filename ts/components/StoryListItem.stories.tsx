// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';

import type { PropsType } from './StoryListItem';
import { StoryListItem } from './StoryListItem';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import {
  fakeAttachment,
  fakeThumbnail,
} from '../test-both/helpers/fakeAttachment';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/StoryListItem',
  component: StoryListItem,
  argTypes: {
    conversationId: {
      defaultValue: getDefaultConversation().id,
    },
    getPreferredBadge: { action: true },
    i18n: {
      defaultValue: i18n,
    },
    onGoToConversation: { action: true },
    onHideStory: { action: true },
    queueStoryDownload: { action: true },
    story: {
      defaultValue: {
        messageId: '123',
        sender: getDefaultConversation(),
        timestamp: Date.now(),
      },
    },
    viewUserStories: { action: true },
  },
} as Meta;

const Template: Story<PropsType> = args => <StoryListItem {...args} />;

export const SomeonesStory = Template.bind({});
SomeonesStory.args = {
  group: getDefaultConversation({ title: 'Sports Group' }),
  story: {
    attachment: fakeAttachment({
      thumbnail: fakeThumbnail('/fixtures/tina-rolf-269345-unsplash.jpg'),
    }),
    hasReplies: true,
    isUnread: true,
    messageId: '123',
    sender: getDefaultConversation(),
    timestamp: Date.now(),
  },
};
SomeonesStory.story = {
  name: "Someone's story",
};
