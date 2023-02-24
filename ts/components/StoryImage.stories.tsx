// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { v4 as uuid } from 'uuid';
import { action } from '@storybook/addon-actions';
import { noop } from 'lodash';

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
    onMediaPlaybackStart: noop,
  };
}

export function GoodStory(): JSX.Element {
  return <StoryImage {...getDefaultProps()} />;
}

GoodStory.story = {
  name: 'Good story',
};

export function GoodStoryThumbnail(): JSX.Element {
  return <StoryImage {...getDefaultProps()} isThumbnail />;
}

GoodStoryThumbnail.story = {
  name: 'Good story (thumbnail)',
};

export function NotDownloaded(): JSX.Element {
  return <StoryImage {...getDefaultProps()} attachment={fakeAttachment()} />;
}

NotDownloaded.story = {
  name: 'Not downloaded',
};

export function NotDownloadedThumbnail(): JSX.Element {
  return (
    <StoryImage
      {...getDefaultProps()}
      attachment={fakeAttachment()}
      isThumbnail
    />
  );
}

NotDownloadedThumbnail.story = {
  name: 'Not downloaded (thumbnail)',
};

export function PendingDownload(): JSX.Element {
  return (
    <StoryImage
      {...getDefaultProps()}
      attachment={fakeAttachment({
        pending: true,
      })}
    />
  );
}

PendingDownload.story = {
  name: 'Pending download',
};

export function PendingDownloadThumbnail(): JSX.Element {
  return (
    <StoryImage
      {...getDefaultProps()}
      attachment={fakeAttachment({
        pending: true,
      })}
      isThumbnail
    />
  );
}

PendingDownloadThumbnail.story = {
  name: 'Pending download (thumbnail)',
};

export function BrokenImage(): JSX.Element {
  return (
    <StoryImage
      {...getDefaultProps()}
      attachment={fakeAttachment({
        url: '/this/path/does/not/exist.jpg',
      })}
    />
  );
}

export function BrokenImageThumbnail(): JSX.Element {
  return (
    <StoryImage
      {...getDefaultProps()}
      attachment={fakeAttachment({
        url: '/this/path/does/not/exist.jpg',
      })}
      isThumbnail
    />
  );
}

BrokenImageThumbnail.story = {
  name: 'Broken Image (thumbnail)',
};

export function Video(): JSX.Element {
  return (
    <StoryImage
      {...getDefaultProps()}
      attachment={fakeAttachment({
        contentType: VIDEO_MP4,
        url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
      })}
    />
  );
}

export function ErrorImage(): JSX.Element {
  return (
    <StoryImage
      {...getDefaultProps()}
      attachment={fakeAttachment({
        error: true,
        url: '/this/path/does/not/exist.jpg',
      })}
    />
  );
}

export function ErrorImageThumbnail(): JSX.Element {
  return (
    <StoryImage
      {...getDefaultProps()}
      attachment={fakeAttachment({
        error: true,
        url: '/this/path/does/not/exist.jpg',
      })}
      isThumbnail
    />
  );
}

ErrorImageThumbnail.story = {
  name: 'Error Image (thumbnail)',
};

export function ErrorImageYou(): JSX.Element {
  return (
    <StoryImage
      {...getDefaultProps()}
      isMe
      attachment={fakeAttachment({
        error: true,
        url: '/this/path/does/not/exist.jpg',
      })}
    />
  );
}
