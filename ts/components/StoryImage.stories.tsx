// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { v4 as uuid } from 'uuid';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './StoryImage';
import { StoryImage } from './StoryImage';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';
import {
  fakeAttachment,
  fakeThumbnail,
} from '../test-both/helpers/fakeAttachment';
import { VIDEO_MP4 } from '../types/MIME';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/StoryImage',
};

function getDefaultProps(): PropsType {
  return {
    attachment: fakeAttachment({
      url: '/fixtures/nathan-anderson-316188-unsplash.jpg',
      thumbnail: fakeThumbnail('/fixtures/nathan-anderson-316188-unsplash.jpg'),
    }),
    firstName: 'Charlie',
    i18n,
    label: 'A story',
    queueStoryDownload: action('queueStoryDownload'),
    storyId: uuid(),
  };
}

export const GoodStory = (): JSX.Element => (
  <StoryImage {...getDefaultProps()} />
);

GoodStory.story = {
  name: 'Good story',
};

export const GoodStoryThumbnail = (): JSX.Element => (
  <StoryImage {...getDefaultProps()} isThumbnail />
);

GoodStoryThumbnail.story = {
  name: 'Good story (thumbnail)',
};

export const NotDownloaded = (): JSX.Element => (
  <StoryImage {...getDefaultProps()} attachment={fakeAttachment()} />
);

NotDownloaded.story = {
  name: 'Not downloaded',
};

export const NotDownloadedThumbnail = (): JSX.Element => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment()}
    isThumbnail
  />
);

NotDownloadedThumbnail.story = {
  name: 'Not downloaded (thumbnail)',
};

export const PendingDownload = (): JSX.Element => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      pending: true,
    })}
  />
);

PendingDownload.story = {
  name: 'Pending download',
};

export const PendingDownloadThumbnail = (): JSX.Element => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      pending: true,
    })}
    isThumbnail
  />
);

PendingDownloadThumbnail.story = {
  name: 'Pending download (thumbnail)',
};

export const BrokenImage = (): JSX.Element => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      url: '/this/path/does/not/exist.jpg',
    })}
  />
);

export const BrokenImageThumbnail = (): JSX.Element => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      url: '/this/path/does/not/exist.jpg',
    })}
    isThumbnail
  />
);

BrokenImageThumbnail.story = {
  name: 'Broken Image (thumbnail)',
};

export const Video = (): JSX.Element => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      contentType: VIDEO_MP4,
      url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
    })}
  />
);

export const ErrorImage = (): JSX.Element => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      error: true,
      url: '/this/path/does/not/exist.jpg',
    })}
  />
);

export const ErrorImageThumbnail = (): JSX.Element => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      error: true,
      url: '/this/path/does/not/exist.jpg',
    })}
    isThumbnail
  />
);

ErrorImageThumbnail.story = {
  name: 'Error Image (thumbnail)',
};

export const ErrorImageYou = (): JSX.Element => (
  <StoryImage
    {...getDefaultProps()}
    isMe
    attachment={fakeAttachment({
      error: true,
      url: '/this/path/does/not/exist.jpg',
    })}
  />
);
