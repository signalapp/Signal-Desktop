import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { CaptionEditor, Props } from './CaptionEditor';
import { AUDIO_MP3, IMAGE_JPEG, VIDEO_MP4 } from '../types/MIME';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const stories = storiesOf('Components/Caption Editor', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  attachment: {
    contentType: IMAGE_JPEG,
    fileName: '',
    url: '',
    ...overrideProps.attachment,
  },
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
    attachment: {
      contentType: VIDEO_MP4,
      fileName: 'pixabay-Soap-Bubble-7141.mp4',
      url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
    },
    url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
  });

  return <CaptionEditor {...props} />;
});

stories.add('Video with Caption', () => {
  const props = createProps({
    attachment: {
      contentType: VIDEO_MP4,
      fileName: 'pixabay-Soap-Bubble-7141.mp4',
      url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
    },
    caption:
      'This is the user-provided caption. We show it overlaid on the image. If it is really long, then it wraps, but it does not get too close to the edges of the image.',
    url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
  });

  return <CaptionEditor {...props} />;
});

stories.add('Unsupported Attachment Type', () => {
  const props = createProps({
    attachment: {
      contentType: AUDIO_MP3,
      fileName: 'incompetech-com-Agnus-Dei-X.mp3',
      url: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
    },
    url: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
  });

  return <CaptionEditor {...props} />;
});
