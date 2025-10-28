// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { StorybookThemeContext } from '../../../../.storybook/StorybookThemeContext.std.js';
import type { MediaItemType } from '../../../types/MediaItem.std.js';
import { SignalService } from '../../../protobuf/index.std.js';
import {
  IMAGE_JPEG,
  VIDEO_MP4,
  APPLICATION_OCTET_STREAM,
  type MIMEType,
} from '../../../types/MIME.std.js';
import type { Props } from './MediaGridItem.dom.js';
import { MediaGridItem } from './MediaGridItem.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/MediaGallery/MediaGridItem',
} satisfies Meta<Props>;

const createProps = (
  overrideProps: Partial<Props> & { mediaItem: MediaItemType }
): Props => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const theme = React.useContext(StorybookThemeContext);

  return {
    i18n,
    theme,
    mediaItem: overrideProps.mediaItem,
    onClick: action('onClick'),
  };
};

type OverridePropsMediaItemType = Partial<MediaItemType> & {
  objectURL?: string;
  contentType?: MIMEType;
};

const createMediaItem = (
  overrideProps: OverridePropsMediaItemType
): MediaItemType => ({
  index: 0,
  attachment: overrideProps.attachment || {
    path: '123',
    contentType: overrideProps.contentType ?? IMAGE_JPEG,
    size: 123,
    url: overrideProps.objectURL,
    blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
    isPermanentlyUndownloadable: false,
  },
  message: {
    type: 'incoming',
    conversationId: '1234',
    id: 'id',
    receivedAt: Date.now(),
    receivedAtMs: Date.now(),
    sentAt: Date.now(),
  },
});

export function Image(): JSX.Element {
  const mediaItem = createMediaItem({
    objectURL: '/fixtures/kitten-1-64-64.jpg',
    contentType: IMAGE_JPEG,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function WideImage(): JSX.Element {
  const mediaItem = createMediaItem({
    objectURL: '/fixtures/wide.jpg',
    contentType: IMAGE_JPEG,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function TallImage(): JSX.Element {
  const mediaItem = createMediaItem({
    objectURL: '/fixtures/snow.jpg',
    contentType: IMAGE_JPEG,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function Video(): JSX.Element {
  const mediaItem = createMediaItem({
    attachment: {
      incrementalUrl: 'abc',
      screenshot: {
        url: '/fixtures/kitten-2-64-64.jpg',
        contentType: IMAGE_JPEG,
      },
      contentType: VIDEO_MP4,
      size: 1024,
      isPermanentlyUndownloadable: false,
      path: 'abcd',
    },
    contentType: VIDEO_MP4,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function GIF(): JSX.Element {
  const mediaItem = createMediaItem({
    attachment: {
      url: 'abc',
      screenshot: {
        url: '/fixtures/kitten-2-64-64.jpg',
        contentType: IMAGE_JPEG,
      },
      contentType: VIDEO_MP4,
      size: 1024,
      isPermanentlyUndownloadable: false,
      path: 'abcd',
      flags: SignalService.AttachmentPointer.Flags.GIF,
    },
    contentType: VIDEO_MP4,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function MissingImage(): JSX.Element {
  const mediaItem = createMediaItem({
    contentType: IMAGE_JPEG,
    attachment: {
      contentType: IMAGE_JPEG,
      size: 123,
      blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
      isPermanentlyUndownloadable: false,
    },
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function PendingImage(): JSX.Element {
  const mediaItem = createMediaItem({
    contentType: IMAGE_JPEG,
    attachment: {
      contentType: IMAGE_JPEG,
      size: 123000,
      blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
      isPermanentlyUndownloadable: false,
      totalDownloaded: undefined,
      pending: true,
    },
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function DownloadingImage(): JSX.Element {
  const mediaItem = createMediaItem({
    contentType: IMAGE_JPEG,
    attachment: {
      contentType: IMAGE_JPEG,
      size: 123000,
      blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
      isPermanentlyUndownloadable: false,
      totalDownloaded: 20300,
      pending: true,
    },
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function MissingVideo(): JSX.Element {
  const mediaItem = createMediaItem({
    contentType: VIDEO_MP4,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function BrokenImage(): JSX.Element {
  const mediaItem = createMediaItem({
    objectURL: '/missing-fixtures/nope.jpg',
    contentType: IMAGE_JPEG,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function BrokenVideo(): JSX.Element {
  const mediaItem = createMediaItem({
    objectURL: '/missing-fixtures/nope.mp4',
    contentType: VIDEO_MP4,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}

export function OtherContentType(): JSX.Element {
  const mediaItem = createMediaItem({
    contentType: APPLICATION_OCTET_STREAM,
  });

  const props = createProps({
    mediaItem,
  });

  return <MediaGridItem {...props} />;
}
