// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';

import { AttachmentList, Props } from './AttachmentList';
import {
  AUDIO_MP3,
  IMAGE_GIF,
  IMAGE_JPEG,
  MIMEType,
  VIDEO_MP4,
} from '../../types/MIME';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/AttachmentList', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  attachments: overrideProps.attachments || [],
  i18n,
  onAddAttachment: action('onAddAttachment'),
  onClickAttachment: action('onClickAttachment'),
  onClose: action('onClose'),
  onCloseAttachment: action('onCloseAttachment'),
});

story.add('One File', () => {
  const props = createProps({
    attachments: [
      {
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
      },
    ],
  });
  return <AttachmentList {...props} />;
});

story.add('Multiple Visual Attachments', () => {
  const props = createProps({
    attachments: [
      {
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
      },
      {
        contentType: VIDEO_MP4,
        fileName: 'pixabay-Soap-Bubble-7141.mp4',
        url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
        screenshot: {
          height: 112,
          width: 112,
          url: '/fixtures/kitten-4-112-112.jpg',
          contentType: IMAGE_JPEG,
        },
      },
      {
        contentType: IMAGE_GIF,
        fileName: 'giphy-GVNv0UpeYm17e',
        url: '/fixtures/giphy-GVNvOUpeYmI7e.gif',
      },
    ],
  });

  return <AttachmentList {...props} />;
});

story.add('Multiple with Non-Visual Types', () => {
  const props = createProps({
    attachments: [
      {
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
      },
      {
        contentType: 'text/plain' as MIMEType,
        fileName: 'lorem-ipsum.txt',
        url: '/fixtures/lorem-ipsum.txt',
      },
      {
        contentType: AUDIO_MP3,
        fileName: 'incompetech-com-Agnus-Dei-X.mp3',
        url: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
      },
      {
        contentType: VIDEO_MP4,
        fileName: 'pixabay-Soap-Bubble-7141.mp4',
        url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
        screenshot: {
          height: 112,
          width: 112,
          url: '/fixtures/kitten-4-112-112.jpg',
          contentType: IMAGE_JPEG,
        },
      },
      {
        contentType: IMAGE_GIF,
        fileName: 'giphy-GVNv0UpeYm17e',
        url: '/fixtures/giphy-GVNvOUpeYmI7e.gif',
      },
    ],
  });

  return <AttachmentList {...props} />;
});

story.add('Empty List', () => {
  const props = createProps();

  return <AttachmentList {...props} />;
});
