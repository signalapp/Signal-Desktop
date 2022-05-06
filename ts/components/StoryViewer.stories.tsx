// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './StoryViewer';
import { StoryViewer } from './StoryViewer';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { fakeAttachment } from '../test-both/helpers/fakeAttachment';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/StoryViewer', module);

function getDefaultProps(): PropsType {
  const sender = getDefaultConversation();

  return {
    conversationId: sender.id,
    getPreferredBadge: () => undefined,
    group: undefined,
    hasAllStoriesMuted: false,
    i18n,
    loadStoryReplies: action('loadStoryReplies'),
    markStoryRead: action('markStoryRead'),
    onClose: action('onClose'),
    onGoToConversation: action('onGoToConversation'),
    onHideStory: action('onHideStory'),
    onNextUserStories: action('onNextUserStories'),
    onPrevUserStories: action('onPrevUserStories'),
    onReactToStory: action('onReactToStory'),
    onReplyToStory: action('onReplyToStory'),
    onSetSkinTone: action('onSetSkinTone'),
    onTextTooLong: action('onTextTooLong'),
    onUseEmoji: action('onUseEmoji'),
    preferredReactionEmoji: ['❤️', '👍', '👎', '😂', '😮', '😢'],
    queueStoryDownload: action('queueStoryDownload'),
    renderEmojiPicker: () => <div />,
    stories: [
      {
        attachment: fakeAttachment({
          path: 'snow.jpg',
          url: '/fixtures/snow.jpg',
        }),
        canReply: true,
        messageId: '123',
        sender,
        timestamp: Date.now(),
      },
    ],
    toggleHasAllStoriesMuted: action('toggleHasAllStoriesMuted'),
  };
}

story.add("Someone's story", () => <StoryViewer {...getDefaultProps()} />);

story.add('Wide story', () => (
  <StoryViewer
    {...getDefaultProps()}
    stories={[
      {
        attachment: fakeAttachment({
          path: 'file.jpg',
          url: '/fixtures/nathan-anderson-316188-unsplash.jpg',
        }),
        canReply: true,
        messageId: '123',
        sender: getDefaultConversation(),
        timestamp: Date.now(),
      },
    ]}
  />
));

story.add('In a group', () => (
  <StoryViewer
    {...getDefaultProps()}
    group={getDefaultConversation({
      avatarPath: '/fixtures/kitten-4-112-112.jpg',
      title: 'Family Group',
      type: 'group',
    })}
  />
));

story.add('Multi story', () => {
  const sender = getDefaultConversation();
  return (
    <StoryViewer
      {...getDefaultProps()}
      stories={[
        {
          attachment: fakeAttachment({
            path: 'snow.jpg',
            url: '/fixtures/snow.jpg',
          }),
          messageId: '123',
          sender,
          timestamp: Date.now(),
        },
        {
          attachment: fakeAttachment({
            path: 'file.jpg',
            url: '/fixtures/nathan-anderson-316188-unsplash.jpg',
          }),
          canReply: true,
          messageId: '456',
          sender,
          timestamp: Date.now() - 3600,
        },
      ]}
    />
  );
});

story.add('Caption', () => (
  <StoryViewer
    {...getDefaultProps()}
    group={getDefaultConversation({
      avatarPath: '/fixtures/kitten-4-112-112.jpg',
      title: 'Broskis',
      type: 'group',
    })}
    replyState={{
      messageId: '123',
      replies: [
        {
          ...getDefaultConversation(),
          body: 'Cool',
          id: 'abc',
          timestamp: Date.now(),
        },
      ],
    }}
    stories={[
      {
        attachment: fakeAttachment({
          caption: 'This place looks lovely',
          path: 'file.jpg',
          url: '/fixtures/nathan-anderson-316188-unsplash.jpg',
        }),
        canReply: true,
        messageId: '123',
        sender: getDefaultConversation(),
        timestamp: Date.now(),
      },
    ]}
  />
));

story.add('Long Caption', () => (
  <StoryViewer
    {...getDefaultProps()}
    hasAllStoriesMuted
    stories={[
      {
        attachment: fakeAttachment({
          caption:
            'Snowycle, snowycle, snowycle\nI want to ride my snowycle, snowycle, snowycle\nI want to ride my snowycle\nI want to ride my snow\nI want to ride my snowycle\nI want to ride it where I like\nSnowycle, snowycle, snowycle\nI want to ride my snowycle, snowycle, snowycle\nI want to ride my snowycle\nI want to ride my snow\nI want to ride my snowycle\nI want to ride it where I like\nSnowycle, snowycle, snowycle\nI want to ride my snowycle, snowycle, snowycle\nI want to ride my snowycle\nI want to ride my snow\nI want to ride my snowycle\nI want to ride it where I like',
          path: 'file.jpg',
          url: '/fixtures/snow.jpg',
        }),
        canReply: true,
        messageId: '123',
        sender: getDefaultConversation(),
        timestamp: Date.now(),
      },
    ]}
  />
));
