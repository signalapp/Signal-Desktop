// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './StoriesTab';
import { StoriesTab } from './StoriesTab';
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
  title: 'Components/StoriesTab',
  component: StoriesTab,
  args: {
    deleteStoryForEveryone: action('deleteStoryForEveryone'),
    getPreferredBadge: () => undefined,
    hiddenStories: [],
    i18n,
    maxAttachmentSizeInKb: 100 * 1024,
    me: getDefaultConversation(),
    myStories: [],
    onForwardStory: action('onForwardStory'),
    onSaveStory: action('onSaveStory'),
    preferredWidthFromStorage: 380,
    queueStoryDownload: action('queueStoryDownload'),
    renderToastManager: () => <i />,
    renderStoryCreator: () => <>StoryCreator</>,
    retryMessageSend: action('retryMessageSend'),
    showConversation: action('showConversation'),
    showStoriesSettings: action('showStoriesSettings'),
    showToast: action('showToast'),
    stories: [],
    toggleHideStories: action('toggleHideStories'),
    viewUserStories: action('viewUserStories'),
    viewStory: action('viewStory'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => <StoriesTab {...args} />;

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
