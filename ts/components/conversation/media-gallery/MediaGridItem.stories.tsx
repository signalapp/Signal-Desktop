import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text, withKnobs } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';
import { MediaItemType } from '../../LightboxGallery';
import { AttachmentType } from '../../../types/Attachment';
import { MIMEType } from '../../../types/MIME';

import { MediaGridItem, Props } from './MediaGridItem';
import { Message } from './types/Message';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/MediaGallery/MediaGridItem',
  module
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
story.addDecorator((withKnobs as any)({ escapeHTML: false }));

const createProps = (
  overrideProps: Partial<Props> & { mediaItem: MediaItemType }
): Props => ({
  i18n,
  mediaItem: overrideProps.mediaItem,
  onClick: action('onClick'),
});

const createMediaItem = (
  overrideProps: Partial<MediaItemType> = {}
): MediaItemType => ({
  thumbnailObjectUrl: text(
    'thumbnailObjectUrl',
    overrideProps.thumbnailObjectUrl || ''
  ),
  contentType: text('contentType', overrideProps.contentType || '') as MIMEType,
  index: 0,
  attachment: {} as AttachmentType, // attachment not useful in the component
  message: {} as Message, // message not used in the component
});

story.add('Image', () => {
  const mediaItem = createMediaItem({
    thumbnailObjectUrl: '/fixtures/kitten-1-64-64.jpg',
    contentType: 'image/jpeg' as MIMEType,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
});

story.add('Video', () => {
  const mediaItem = createMediaItem({
    thumbnailObjectUrl: '/fixtures/kitten-2-64-64.jpg',
    contentType: 'video/mp4' as MIMEType,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
});

story.add('Missing Image', () => {
  const mediaItem = createMediaItem({
    contentType: 'image/jpeg' as MIMEType,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
});

story.add('Missing Video', () => {
  const mediaItem = createMediaItem({
    contentType: 'video/mp4' as MIMEType,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
});

story.add('Broken Image', () => {
  const mediaItem = createMediaItem({
    thumbnailObjectUrl: '/missing-fixtures/nope.jpg',
    contentType: 'image/jpeg' as MIMEType,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
});

story.add('Broken Video', () => {
  const mediaItem = createMediaItem({
    thumbnailObjectUrl: '/missing-fixtures/nope.mp4',
    contentType: 'video/mp4' as MIMEType,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
});

story.add('Other ContentType', () => {
  const mediaItem = createMediaItem({
    contentType: 'application/text' as MIMEType,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
});
