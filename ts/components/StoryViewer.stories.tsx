// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';

import type { PropsType } from './StoryViewer';
import enMessages from '../../_locales/en/messages.json';
import { SendStatus } from '../messages/MessageSendState';
import { StoryViewer } from './StoryViewer';
import { VIDEO_MP4 } from '../types/MIME';
import { fakeAttachment } from '../test-both/helpers/fakeAttachment';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { getFakeStoryView } from '../test-both/helpers/getFakeStory';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/StoryViewer',
  component: StoryViewer,
  argTypes: {
    currentIndex: {
      defaultvalue: 0,
    },
    getPreferredBadge: { action: true },
    group: {
      defaultValue: undefined,
    },
    hasAllStoriesMuted: {
      defaultValue: false,
    },
    i18n: {
      defaultValue: i18n,
    },
    loadStoryReplies: { action: true },
    markStoryRead: { action: true },
    numStories: {
      defaultValue: 1,
    },
    onGoToConversation: { action: true },
    onHideStory: { action: true },
    onReactToStory: { action: true },
    onReplyToStory: { action: true },
    onSetSkinTone: { action: true },
    onTextTooLong: { action: true },
    onUseEmoji: { action: true },
    preferredReactionEmoji: {
      defaultValue: ['❤️', '👍', '👎', '😂', '😮', '😢'],
    },
    queueStoryDownload: { action: true },
    renderEmojiPicker: { action: true },
    showToast: { action: true },
    skinTone: {
      defaultValue: 0,
    },
    story: {
      defaultValue: getFakeStoryView(),
    },
    toggleHasAllStoriesMuted: { action: true },
    viewStory: { action: true },
  },
} as Meta;

const Template: Story<PropsType> = args => <StoryViewer {...args} />;

export const SomeonesStory = Template.bind({});
SomeonesStory.args = {};
SomeonesStory.story = {
  name: "Someone's story",
};

export const WideStory = Template.bind({});
WideStory.args = {
  story: getFakeStoryView('/fixtures/nathan-anderson-316188-unsplash.jpg'),
};
WideStory.story = {
  name: 'Wide story',
};

export const InAGroup = Template.bind({});
InAGroup.args = {
  group: getDefaultConversation({
    avatarPath: '/fixtures/kitten-4-112-112.jpg',
    title: 'Family Group',
    type: 'group',
  }),
};
InAGroup.story = {
  name: 'In a group',
};

export const MultiStory = Template.bind({});
MultiStory.args = {
  currentIndex: 2,
  numStories: 7,
  story: {
    ...getFakeStoryView(),
    attachment: fakeAttachment({
      contentType: VIDEO_MP4,
      fileName: 'pixabay-Soap-Bubble-7141.mp4',
      url: '/fixtures/kitten-4-112-112.jpg',
      screenshotPath: '/fixtures/kitten-4-112-112.jpg',
    }),
  },
};
MultiStory.story = {
  name: 'Multi story',
};

export const Caption = Template.bind({});
Caption.args = {
  story: {
    ...getFakeStoryView(),
    attachment: fakeAttachment({
      caption: 'This place looks lovely',
      path: 'file.jpg',
      url: '/fixtures/nathan-anderson-316188-unsplash.jpg',
    }),
  },
};

export const LongCaption = Template.bind({});
LongCaption.args = {
  story: {
    ...getFakeStoryView(),
    attachment: fakeAttachment({
      caption:
        'Snowycle, snowycle, snowycle\nI want to ride my snowycle, snowycle, snowycle\nI want to ride my snowycle\nI want to ride my snow\nI want to ride my snowycle\nI want to ride it where I like\nSnowycle, snowycle, snowycle\nI want to ride my snowycle, snowycle, snowycle\nI want to ride my snowycle\nI want to ride my snow\nI want to ride my snowycle\nI want to ride it where I like\nSnowycle, snowycle, snowycle\nI want to ride my snowycle, snowycle, snowycle\nI want to ride my snowycle\nI want to ride my snow\nI want to ride my snowycle\nI want to ride it where I like',
      path: 'file.jpg',
      url: '/fixtures/snow.jpg',
    }),
  },
};

export const YourStory = Template.bind({});
{
  const storyView = getFakeStoryView(
    '/fixtures/nathan-anderson-316188-unsplash.jpg'
  );

  YourStory.args = {
    story: {
      ...storyView,
      sender: {
        ...storyView.sender,
        isMe: true,
      },
      sendState: [
        {
          recipient: getDefaultConversation(),
          status: SendStatus.Viewed,
        },
        {
          recipient: getDefaultConversation(),
          status: SendStatus.Delivered,
        },
        {
          recipient: getDefaultConversation(),
          status: SendStatus.Pending,
        },
      ],
    },
  };
  YourStory.storyName = 'Your story';
}
