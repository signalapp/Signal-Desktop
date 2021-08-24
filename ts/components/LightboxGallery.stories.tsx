// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { number } from '@storybook/addon-knobs';

import { LightboxGallery, Props } from './LightboxGallery';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import { IMAGE_JPEG, VIDEO_MP4 } from '../types/MIME';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/LightboxGallery', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  close: action('close'),
  i18n,
  media: overrideProps.media || [],
  onSave: action('onSave'),
  selectedIndex: number('selectedIndex', overrideProps.selectedIndex || 0),
});

story.add('Image and Video', () => {
  const props = createProps({
    media: [
      {
        attachment: {
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          caption:
            'Still from The Lighthouse, starring Robert Pattinson and Willem Defoe.',
        },
        contentType: IMAGE_JPEG,
        index: 0,
        message: {
          attachments: [],
          id: 'image-msg',
          received_at: 1,
          received_at_ms: Date.now(),
        },
        objectURL: '/fixtures/tina-rolf-269345-unsplash.jpg',
      },
      {
        attachment: {
          contentType: VIDEO_MP4,
          fileName: 'pixabay-Soap-Bubble-7141.mp4',
          url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
        },
        contentType: VIDEO_MP4,
        index: 1,
        message: {
          attachments: [],
          id: 'video-msg',
          received_at: 2,
          received_at_ms: Date.now(),
        },
        objectURL: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
      },
    ],
  });

  return <LightboxGallery {...props} />;
});

story.add('Missing Media', () => {
  const props = createProps({
    media: [
      {
        attachment: {
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        },
        contentType: IMAGE_JPEG,
        index: 0,
        message: {
          attachments: [],
          id: 'image-msg',
          received_at: 3,
          received_at_ms: Date.now(),
        },
        objectURL: undefined,
      },
    ],
  });

  return <LightboxGallery {...props} />;
});
