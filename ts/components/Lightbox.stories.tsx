import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { Lightbox, Props } from './Lightbox';
import {
  AUDIO_MP3,
  IMAGE_JPEG,
  MIMEType,
  VIDEO_MP4,
  VIDEO_QUICKTIME,
} from '../types/MIME';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Lightbox', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  caption: text('caption', overrideProps.caption || ''),
  close: action('close'),
  contentType: overrideProps.contentType || IMAGE_JPEG,
  i18n,
  isViewOnce: boolean('isViewOnce', overrideProps.isViewOnce || false),
  objectURL: text('objectURL', overrideProps.objectURL || ''),
  onNext: overrideProps.onNext,
  onPrevious: overrideProps.onPrevious,
  onSave: overrideProps.onSave,
});

story.add('Image', () => {
  const props = createProps({
    objectURL: '/fixtures/tina-rolf-269345-unsplash.jpg',
  });

  return <Lightbox {...props} />;
});

story.add('Image with Caption', () => {
  const props = createProps({
    caption:
      'This is the user-provided caption. It can get long and wrap onto multiple lines.',
    objectURL: '/fixtures/tina-rolf-269345-unsplash.jpg',
  });

  return <Lightbox {...props} />;
});

story.add('Video', () => {
  const props = createProps({
    contentType: VIDEO_MP4,
    objectURL: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
  });

  return <Lightbox {...props} />;
});

story.add('Video with Caption', () => {
  const props = createProps({
    caption:
      'This is the user-provided caption. It can get long and wrap onto multiple lines.',
    contentType: VIDEO_MP4,
    objectURL: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
  });

  return <Lightbox {...props} />;
});

story.add('Video (View Once)', () => {
  const props = createProps({
    contentType: VIDEO_MP4,
    isViewOnce: true,
    objectURL: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
  });

  return <Lightbox {...props} />;
});

story.add('Unsupported Image Type', () => {
  const props = createProps({
    contentType: 'image/tiff' as MIMEType,
    objectURL: 'unsupported-image.tiff',
  });

  return <Lightbox {...props} />;
});

story.add('Unsupported Video Type', () => {
  const props = createProps({
    contentType: VIDEO_QUICKTIME,
    objectURL: 'unsupported-video.mov',
  });

  return <Lightbox {...props} />;
});

story.add('Unsupported ContentType', () => {
  const props = createProps({
    contentType: AUDIO_MP3,
    objectURL: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
  });

  return <Lightbox {...props} />;
});

story.add('Including Next/Previous/Save Callbacks', () => {
  const props = createProps({
    objectURL: '/fixtures/tina-rolf-269345-unsplash.jpg',
    onNext: action('onNext'),
    onPrevious: action('onPrevious'),
    onSave: action('onSave'),
  });

  return <Lightbox {...props} />;
});
