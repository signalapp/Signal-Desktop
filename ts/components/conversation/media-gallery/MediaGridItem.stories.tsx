// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { MediaItemType } from '../../../types/MediaItem';
import type { AttachmentType } from '../../../types/Attachment';
import { stringToMIMEType } from '../../../types/MIME';
import type { Props } from './MediaGridItem';
import { MediaGridItem } from './MediaGridItem';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/MediaGallery/MediaGridItem',
} satisfies Meta<Props>;

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
  thumbnailObjectUrl: overrideProps.thumbnailObjectUrl || '',
  contentType: overrideProps.contentType || stringToMIMEType(''),
  index: 0,
  attachment: {} as AttachmentType, // attachment not useful in the component
  message: {
    attachments: [],
    conversationId: '1234',
    id: 'id',
    receivedAt: Date.now(),
    receivedAtMs: Date.now(),
    sentAt: Date.now(),
  },
});

export function Image(): JSX.Element {
  const mediaItem = createMediaItem({
    thumbnailObjectUrl: '/fixtures/kitten-1-64-64.jpg',
    contentType: stringToMIMEType('image/jpeg'),
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function Video(): JSX.Element {
  const mediaItem = createMediaItem({
    thumbnailObjectUrl: '/fixtures/kitten-2-64-64.jpg',
    contentType: stringToMIMEType('video/mp4'),
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function MissingImage(): JSX.Element {
  const mediaItem = createMediaItem({
    contentType: stringToMIMEType('image/jpeg'),
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function MissingVideo(): JSX.Element {
  const mediaItem = createMediaItem({
    contentType: stringToMIMEType('video/mp4'),
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function BrokenImage(): JSX.Element {
  const mediaItem = createMediaItem({
    thumbnailObjectUrl: '/missing-fixtures/nope.jpg',
    contentType: stringToMIMEType('image/jpeg'),
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function BrokenVideo(): JSX.Element {
  const mediaItem = createMediaItem({
    thumbnailObjectUrl: '/missing-fixtures/nope.mp4',
    contentType: stringToMIMEType('video/mp4'),
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function OtherContentType(): JSX.Element {
  const mediaItem = createMediaItem({
    contentType: stringToMIMEType('application/text'),
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}
