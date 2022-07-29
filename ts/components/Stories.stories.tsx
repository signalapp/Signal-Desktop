// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';

import type { PropsType } from './Stories';
import { Stories } from './Stories';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import {
  getFakeMyStory,
  getFakeStory,
} from '../test-both/helpers/getFakeStory';
import * as durations from '../util/durations';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Stories',
  component: Stories,
  argTypes: {
    deleteStoryForEveryone: { action: true },
    getPreferredBadge: { action: true },
    hiddenStories: {
      defaultValue: [],
    },
    i18n: {
      defaultValue: i18n,
    },
    me: {
      defaultValue: getDefaultConversation(),
    },
    myStories: {
      defaultValue: [],
    },
    onForwardStory: { action: true },
    onSaveStory: { action: true },
    ourConversationId: {
      defaultValue: getDefaultConversation().id,
    },
    preferredWidthFromStorage: {
      defaultValue: 380,
    },
    queueStoryDownload: { action: true },
    renderStoryCreator: { action: true },
    renderStoryViewer: { action: true },
    showConversation: { action: true },
    showStoriesSettings: { action: true },
    stories: {
      defaultValue: [],
    },
    toggleHideStories: { action: true },
    toggleStoriesView: { action: true },
    viewUserStories: { action: true },
    viewStory: { action: true },
  },
} as Meta;

const Template: Story<PropsType> = args => <Stories {...args} />;

export const Blank = Template.bind({});
Blank.args = {};

export const Many = Template.bind({});
Many.args = {
  stories: [
    getFakeStory({
      attachmentUrl: '/fixtures/tina-rolf-269345-unsplash.jpg',
      timestamp: Date.now() - 2 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/koushik-chowdavarapu-105425-unsplash.jpg',
      timestamp: Date.now() - 5 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/nathan-anderson-316188-unsplash.jpg',
      group: getDefaultConversation({ title: 'BBQ in the park' }),
      timestamp: Date.now() - 65 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/snow.jpg',
      timestamp: Date.now() - 92 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/kitten-1-64-64.jpg',
      timestamp: Date.now() - 164 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/kitten-2-64-64.jpg',
      group: getDefaultConversation({ title: 'Breaking Signal for Science' }),
      timestamp: Date.now() - 380 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/kitten-3-64-64.jpg',
      timestamp: Date.now() - 421 * durations.MINUTE,
    }),
  ],
};

export const HiddenStories = Template.bind({});
HiddenStories.args = {
  hiddenStories: [
    getFakeStory({
      attachmentUrl: '/fixtures/kitten-1-64-64.jpg',
      timestamp: Date.now() - 164 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/kitten-2-64-64.jpg',
      group: getDefaultConversation({ title: 'Breaking Signal for Science' }),
      timestamp: Date.now() - 380 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/kitten-3-64-64.jpg',
      timestamp: Date.now() - 421 * durations.MINUTE,
    }),
  ],
  stories: [
    getFakeStory({
      attachmentUrl: '/fixtures/tina-rolf-269345-unsplash.jpg',
      timestamp: Date.now() - 2 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/snow.jpg',
      timestamp: Date.now() - 92 * durations.MINUTE,
    }),
  ],
};

export const MyStories = Template.bind({});
MyStories.args = {
  myStories: [
    getFakeMyStory(undefined, 'BFF'),
    getFakeMyStory(undefined, 'The Fun Group'),
  ],
  hiddenStories: [
    getFakeStory({
      attachmentUrl: '/fixtures/kitten-1-64-64.jpg',
      timestamp: Date.now() - 164 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/kitten-2-64-64.jpg',
      group: getDefaultConversation({ title: 'Breaking Signal for Science' }),
      timestamp: Date.now() - 380 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/kitten-3-64-64.jpg',
      timestamp: Date.now() - 421 * durations.MINUTE,
    }),
  ],
  stories: [
    getFakeStory({
      attachmentUrl: '/fixtures/tina-rolf-269345-unsplash.jpg',
      timestamp: Date.now() - 2 * durations.MINUTE,
    }),
    getFakeStory({
      attachmentUrl: '/fixtures/snow.jpg',
      timestamp: Date.now() - 92 * durations.MINUTE,
    }),
  ],
};
