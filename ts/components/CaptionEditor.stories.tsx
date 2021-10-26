// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { Props } from './CaptionEditor';
import { CaptionEditor } from './CaptionEditor';
import { AUDIO_MP3, IMAGE_JPEG, VIDEO_MP4 } from '../types/MIME';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import { fakeAttachment } from '../test-both/helpers/fakeAttachment';

const i18n = setupI18n('en', enMessages);

const stories = storiesOf('Components/Caption Editor', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  attachment: fakeAttachment({
    contentType: IMAGE_JPEG,
    fileName: '',
    url: '',
    ...overrideProps.attachment,
  }),
  caption: text('caption', overrideProps.caption || ''),
  close: action('close'),
  i18n,
  onSave: action('onSave'),
  url: text('url', overrideProps.url || ''),
});

stories.add('Image', () => {
  const props = createProps({
    url: '/fixtures/tina-rolf-269345-unsplash.jpg',
  });

  return <CaptionEditor {...props} />;
});

stories.add('Image with Caption', () => {
  const props = createProps({
    caption:
      'This is the user-provided caption. We show it overlaid on the image. If it is really long, then it wraps, but it does not get too close to the edges of the image.',
    url: '/fixtures/tina-rolf-269345-unsplash.jpg',
  });

  return <CaptionEditor {...props} />;
});

stories.add('Video', () => {
  const props = createProps({
    attachment: fakeAttachment({
      contentType: VIDEO_MP4,
      fileName: 'pixabay-Soap-Bubble-7141.mp4',
      url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
    }),
    url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
  });

  return <CaptionEditor {...props} />;
});

stories.add('Video with Caption', () => {
  const props = createProps({
    attachment: fakeAttachment({
      contentType: VIDEO_MP4,
      fileName: 'pixabay-Soap-Bubble-7141.mp4',
      url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
    }),
    caption:
      'This is the user-provided caption. We show it overlaid on the image. If it is really long, then it wraps, but it does not get too close to the edges of the image.',
    url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
  });

  return <CaptionEditor {...props} />;
});

stories.add('Unsupported Attachment Type', () => {
  const props = createProps({
    attachment: fakeAttachment({
      contentType: AUDIO_MP3,
      fileName: 'incompetech-com-Agnus-Dei-X.mp3',
      url: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
    }),
    url: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
  });

  return <CaptionEditor {...props} />;
});
