// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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
};

function getDefaultProps(): PropsType {
  return {
    i18n,
    onClick: action('onClick'),
    onGoToConversation: action('onGoToConversation'),
    onHideStory: action('onHideStory'),
    queueStoryDownload: action('queueStoryDownload'),
    story: {
      messageId: '123',
      sender: getDefaultConversation(),
      timestamp: Date.now(),
    },
  };
}

export const MyStory = (): JSX.Element => (
  <StoryListItem
    {...getDefaultProps()}
    story={{
      messageId: '123',
      sender: getDefaultConversation({ isMe: true }),
      timestamp: Date.now(),
    }}
  />
);

export const MyStoryMany = (): JSX.Element => (
  <StoryListItem
    {...getDefaultProps()}
    story={{
      attachment: fakeAttachment({
        thumbnail: fakeThumbnail(
          '/fixtures/nathan-anderson-316188-unsplash.jpg'
        ),
      }),
      messageId: '123',
      sender: getDefaultConversation({ isMe: true }),
      timestamp: Date.now(),
    }}
    hasMultiple
  />
);

MyStoryMany.story = {
  name: 'My Story (many)',
};

export const SomeonesStory = (): JSX.Element => (
  <StoryListItem
    {...getDefaultProps()}
    group={getDefaultConversation({ title: 'Sports Group' })}
    story={{
      attachment: fakeAttachment({
        thumbnail: fakeThumbnail('/fixtures/tina-rolf-269345-unsplash.jpg'),
      }),
      hasReplies: true,
      isUnread: true,
      messageId: '123',
      sender: getDefaultConversation(),
      timestamp: Date.now(),
    }}
  />
);

SomeonesStory.story = {
  name: "Someone's story",
};
