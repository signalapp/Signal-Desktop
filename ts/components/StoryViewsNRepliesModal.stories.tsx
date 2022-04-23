// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './StoryViewsNRepliesModal';
import * as durations from '../util/durations';
import enMessages from '../../_locales/en/messages.json';
import { IMAGE_JPEG } from '../types/MIME';
import { StoryViewsNRepliesModal } from './StoryViewsNRepliesModal';
import { fakeAttachment } from '../test-both/helpers/fakeAttachment';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/StoryViewsNRepliesModal', module);

function getDefaultProps(): PropsType {
  return {
    authorTitle: getDefaultConversation().title,
    getPreferredBadge: () => undefined,
    i18n,
    isMyStory: false,
    onClose: action('onClose'),
    onSetSkinTone: action('onSetSkinTone'),
    onReact: action('onReact'),
    onReply: action('onReply'),
    onTextTooLong: action('onTextTooLong'),
    onUseEmoji: action('onUseEmoji'),
    preferredReactionEmoji: ['❤️', '👍', '👎', '😂', '😮', '😢'],
    renderEmojiPicker: () => <div />,
    replies: [],
    storyPreviewAttachment: fakeAttachment({
      thumbnail: {
        contentType: IMAGE_JPEG,
        height: 64,
        objectUrl: '/fixtures/nathan-anderson-316188-unsplash.jpg',
        path: '',
        width: 40,
      },
    }),
    views: [],
  };
}

function getViewsAndReplies() {
  const p1 = getDefaultConversation();
  const p2 = getDefaultConversation();
  const p3 = getDefaultConversation();
  const p4 = getDefaultConversation();
  const p5 = getDefaultConversation();

  const views = [
    {
      ...p1,
      timestamp: Date.now() - 20 * durations.MINUTE,
    },
    {
      ...p2,
      timestamp: Date.now() - 25 * durations.MINUTE,
    },
    {
      ...p3,
      timestamp: Date.now() - 15 * durations.MINUTE,
    },
    {
      ...p4,
      timestamp: Date.now() - 5 * durations.MINUTE,
    },
    {
      ...p5,
      timestamp: Date.now() - 30 * durations.MINUTE,
    },
  ];

  const replies = [
    {
      ...p2,
      body: 'So cute ❤️',
      timestamp: Date.now() - 24 * durations.MINUTE,
    },
    {
      ...p3,
      body: "That's awesome",
      timestamp: Date.now() - 13 * durations.MINUTE,
    },
    {
      ...p4,
      reactionEmoji: '❤️',
      timestamp: Date.now() - 5 * durations.MINUTE,
    },
  ];

  return {
    views,
    replies,
  };
}

story.add('Can reply', () => (
  <StoryViewsNRepliesModal {...getDefaultProps()} />
));

story.add('Views only', () => (
  <StoryViewsNRepliesModal
    {...getDefaultProps()}
    isMyStory
    views={getViewsAndReplies().views}
  />
));

story.add('In a group (no replies)', () => (
  <StoryViewsNRepliesModal {...getDefaultProps()} isGroupStory />
));

story.add('In a group', () => {
  const { views, replies } = getViewsAndReplies();

  return (
    <StoryViewsNRepliesModal
      {...getDefaultProps()}
      isGroupStory
      replies={replies}
      views={views}
    />
  );
});
