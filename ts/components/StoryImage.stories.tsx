// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { v4 as uuid } from 'uuid';
import { storiesOf } from '@storybook/react';
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

const story = storiesOf('Components/StoryImage', module);

function getDefaultProps(): PropsType {
  return {
    attachment: fakeAttachment({
      url: '/fixtures/nathan-anderson-316188-unsplash.jpg',
      thumbnail: fakeThumbnail('/fixtures/nathan-anderson-316188-unsplash.jpg'),
    }),
    i18n,
    label: 'A story',
    queueStoryDownload: action('queueStoryDownload'),
    storyId: uuid(),
  };
}

story.add('Good story', () => <StoryImage {...getDefaultProps()} />);

story.add('Good story (thumbnail)', () => (
  <StoryImage {...getDefaultProps()} isThumbnail />
));

story.add('Not downloaded', () => (
  <StoryImage {...getDefaultProps()} attachment={fakeAttachment()} />
));

story.add('Not downloaded (thumbnail)', () => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment()}
    isThumbnail
  />
));

story.add('Pending download', () => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      pending: true,
    })}
  />
));

story.add('Pending download (thumbnail)', () => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      pending: true,
    })}
    isThumbnail
  />
));

story.add('Broken Image', () => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      url: '/this/path/does/not/exist.jpg',
    })}
  />
));

story.add('Broken Image (thumbnail)', () => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      url: '/this/path/does/not/exist.jpg',
    })}
    isThumbnail
  />
));

story.add('Video', () => (
  <StoryImage
    {...getDefaultProps()}
    attachment={fakeAttachment({
      contentType: VIDEO_MP4,
      url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
    })}
  />
));
