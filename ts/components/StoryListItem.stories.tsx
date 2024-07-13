// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { action } from '@storybook/addon-actions';
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
  args: {
    conversationId: getDefaultConversation().id,
    getPreferredBadge: () => undefined,
    i18n,
    onGoToConversation: action('onGoToConversation'),
    onHideStory: action('onHideStory'),
    queueStoryDownload: action('queueStoryDownload'),
    story: {
      messageId: '123',
      sender: getDefaultConversation(),
      timestamp: Date.now(),
      messageIdForLogging: '123',
      expirationTimestamp: undefined,
    },
    viewUserStories: action('viewUserStories'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => <StoryListItem {...args} />;

export const SomeonesStory = Template.bind({});
SomeonesStory.args = {
  hasReplies: true,
  group: getDefaultConversation({ title: 'Sports Group' }),
  story: {
    attachment: fakeAttachment({
      thumbnail: fakeThumbnail('/fixtures/tina-rolf-269345-unsplash.jpg'),
    }),
    isUnread: true,
    messageId: '123',
    messageIdForLogging: 'for logging 123',
    sender: getDefaultConversation(),
    timestamp: Date.now(),
    expirationTimestamp: undefined,
  },
};
