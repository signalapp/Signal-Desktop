// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import React from 'react';
import { action } from '@storybook/addon-actions';
import type { PropsType } from './StoryViewer.dom.js';
import { SendStatus } from '../messages/MessageSendState.std.js';
import { StoryViewModeType } from '../types/Stories.std.js';
import { generateStoryDistributionId } from '../types/StoryDistributionId.std.js';
import { StoryViewer } from './StoryViewer.dom.js';
import { VIDEO_MP4 } from '../types/MIME.std.js';
import { fakeAttachment } from '../test-helpers/fakeAttachment.std.js';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';
import { getFakeStoryView } from '../test-helpers/getFakeStory.dom.js';
import { DEFAULT_PREFERRED_REACTION_EMOJI } from '../reactions/constants.std.js';
import { EmojiSkinTone } from './fun/data/emojis.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/StoryViewer',
  component: StoryViewer,
  argTypes: {
    hasAllStoriesUnmuted: {
      control: 'boolean',
    },
    hasViewReceiptSetting: {
      control: 'boolean',
    },
  },
  args: {
    currentIndex: 0,
    getPreferredBadge: () => undefined,
    group: undefined,
    hasAllStoriesUnmuted: true,
    hasViewReceiptSetting: true,
    i18n,
    platform: 'darwin',
    loadStoryReplies: action('loadStoryReplies'),
    markStoryRead: action('markStoryRead'),
    numStories: 1,
    onGoToConversation: action('onGoToConversation'),
    onHideStory: action('onHideStory'),
    onReactToStory: action('onReactToStory'),
    onReplyToStory: action('onReplyToStory'),
    onTextTooLong: action('onTextTooLong'),
    onSelectEmoji: action('onSelectEmoji'),
    onMediaPlaybackStart: action('onMediaPlaybackStart'),
    preferredReactionEmoji: DEFAULT_PREFERRED_REACTION_EMOJI,
    queueStoryDownload: action('queueStoryDownload'),
    retryMessageSend: action('retryMessageSend'),
    showToast: action('showToast'),
    emojiSkinToneDefault: EmojiSkinTone.None,
    story: getFakeStoryView(),
    storyViewMode: StoryViewModeType.All,
    viewStory: action('viewStory'),
    isWindowActive: true,
  },
} satisfies Meta<PropsType>;

export function SomeonesStory(args: PropsType): JSX.Element {
  return <StoryViewer {...args} />;
}

export function WideStory(args: PropsType): JSX.Element {
  return (
    <StoryViewer
      {...args}
      story={getFakeStoryView('/fixtures/nathan-anderson-316188-unsplash.jpg')}
    />
  );
}

export function InAGroup(args: PropsType): JSX.Element {
  return (
    <StoryViewer
      {...args}
      group={getDefaultConversation({
        avatarUrl: '/fixtures/kitten-4-112-112.jpg',
        title: 'Family Group',
        type: 'group',
      })}
    />
  );
}

export function MultiStory(args: PropsType): JSX.Element {
  return (
    <StoryViewer
      {...args}
      currentIndex={2}
      numStories={7}
      story={{
        ...getFakeStoryView(),
        attachment: fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'pixabay-Soap-Bubble-7141.mp4',
          url: '/fixtures/kitten-4-112-112.jpg',
          screenshotPath: '/fixtures/kitten-4-112-112.jpg',
        }),
      }}
    />
  );
}

export function Caption(args: PropsType): JSX.Element {
  return (
    <StoryViewer
      {...args}
      story={{
        ...getFakeStoryView(),
        attachment: fakeAttachment({
          caption: 'This place looks lovely',
          path: 'file.jpg',
          url: '/fixtures/nathan-anderson-316188-unsplash.jpg',
        }),
      }}
    />
  );
}

export function EmojiCaption(args: PropsType): JSX.Element {
  return (
    <StoryViewer
      {...args}
      story={{
        ...getFakeStoryView(),
        attachment: fakeAttachment({
          caption: 'WOOOOOOOOW 🥰',
          path: 'file.jpg',
          url: '/fixtures/nathan-anderson-316188-unsplash.jpg',
        }),
      }}
    />
  );
}

export function LongCaption(args: PropsType): JSX.Element {
  return (
    <StoryViewer
      {...args}
      story={{
        ...getFakeStoryView(),
        attachment: fakeAttachment({
          caption:
            'Snowycle, snowycle, snowycle\nI want to ride my snowycle, snowycle, snowycle\nI want to ride my snowycle\nI want to ride my snow\nI want to ride my snowycle\nI want to ride it where I like\nSnowycle, snowycle, snowycle\nI want to ride my snowycle, snowycle, snowycle\nI want to ride my snowycle\nI want to ride my snow\nI want to ride my snowycle\nI want to ride it where I like\nSnowycle, snowycle, snowycle\nI want to ride my snowycle, snowycle, snowycle\nI want to ride my snowycle\nI want to ride my snow\nI want to ride my snowycle\nI want to ride it where I like',
          path: 'file.jpg',
          url: '/fixtures/snow.jpg',
        }),
      }}
    />
  );
}

export function YourStory(args: PropsType): JSX.Element {
  const storyView = getFakeStoryView(
    '/fixtures/nathan-anderson-316188-unsplash.jpg'
  );
  return (
    <StoryViewer
      {...args}
      distributionList={{
        id: generateStoryDistributionId(),
        name: 'Close Friends',
      }}
      story={{
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
      }}
    />
  );
}

export function YourStoryFailed(args: PropsType): JSX.Element {
  const storyView = getFakeStoryView(
    '/fixtures/nathan-anderson-316188-unsplash.jpg'
  );

  return (
    <StoryViewer
      {...args}
      distributionList={{
        id: generateStoryDistributionId(),
        name: 'Close Friends',
      }}
      story={{
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
            status: SendStatus.Failed,
          },
        ],
      }}
    />
  );
}

export function ReadReceiptsOff(args: PropsType): JSX.Element {
  const storyView = getFakeStoryView(
    '/fixtures/nathan-anderson-316188-unsplash.jpg'
  );
  return (
    <StoryViewer
      {...args}
      hasViewReceiptSetting={false}
      story={{
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
      }}
    />
  );
}
