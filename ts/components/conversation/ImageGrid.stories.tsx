// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './ImageGrid';
import { ImageGrid } from './ImageGrid';
import {
  AUDIO_MP3,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
  VIDEO_MP4,
  stringToMIMEType,
} from '../../types/MIME';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { pngUrl, squareStickerUrl } from '../../storybook/Fixtures';
import { fakeAttachment } from '../../test-both/helpers/fakeAttachment';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ImageGrid',
  argTypes: {
    bottomOverlay: { control: { type: 'boolean' } },
    isSticker: { control: { type: 'boolean' } },
    stickerSize: { control: { type: 'number' } },
    withContentAbove: { control: { type: 'boolean' } },
    withContentBelow: { control: { type: 'boolean' } },
  },
  args: {
    attachments: [
      fakeAttachment({
        contentType: IMAGE_PNG,
        fileName: 'sax.png',
        height: 1200,
        url: pngUrl,
        width: 800,
      }),
    ],
    bottomOverlay: false,
    direction: 'incoming',
    i18n,
    isSticker: false,
    showVisualAttachment: action('showVisualAttachment'),
    startDownload: action('startDownload'),
    cancelDownload: action('cancelDownload'),
    onError: action('onError'),
    stickerSize: 0,
    tabIndex: 0,
    withContentAbove: false,
    withContentBelow: false,
  },
} satisfies Meta<Props>;

export function OneImage(args: Props): JSX.Element {
  return <ImageGrid {...args} />;
}

export function OneVideo(args: Props): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        fileName: 'sax.png',
        height: 1200,
        url: pngUrl,
        width: 800,
        screenshot: {
          path: 'something',
          url: pngUrl,
          contentType: IMAGE_PNG,
          height: 1200,
          width: 800,
        },
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function OneVideoNotDownloadedNotPending(args: Props): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        fileName: 'sax.png',
        path: undefined,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function OneVideoPendingWDownloadQueued(args: Props): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        fileName: 'sax.png',
        path: undefined,
        pending: true,
        size: 1000000,
        url: undefined,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function OneVideoPendingWDownloadProgress(args: Props): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        fileName: 'sax.png',
        path: undefined,
        pending: true,
        size: 1000000,
        totalDownloaded: 300000,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function OneVideoDownloadProgressNotPending(args: Props): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        fileName: 'sax.png',
        path: undefined,
        size: 1000000,
        totalDownloaded: 300000,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function OneVideoIncrementalNotDownloadedNotPending(
  args: Props
): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        fileName: 'sax.png',
        path: undefined,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
        incrementalMac: 'something',
        chunkSize: 100,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function OneVideoIncrementalPendingWDownloadQueued(
  args: Props
): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        incrementalMac: 'something',
        chunkSize: 100,
        fileName: 'sax.png',
        path: undefined,
        pending: true,
        size: 1000000,
        url: undefined,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function OneVideoIncrementalPendingWDownloadProgress(
  args: Props
): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        incrementalMac: 'something',
        chunkSize: 100,
        fileName: 'sax.png',
        path: undefined,
        pending: true,
        size: 1000000,
        totalDownloaded: 300000,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function OneVideoIncrementalDownloadProgressNotPending(
  args: Props
): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        incrementalMac: 'something',
        chunkSize: 100,
        fileName: 'sax.png',
        path: undefined,
        size: 1000000,
        totalDownloaded: 300000,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function TwoImages(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          width: 3000,
        }),
      ]}
    />
  );
}

export function TwoImagesNotDownloaded(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'sax.png',
          height: 1200,
          width: 800,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
      ]}
    />
  );
}

export function TwoImagesIncrementalNotDownloaded(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'sax.png',
          height: 1200,
          width: 800,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
          incrementalMac: 'something',
          chunkSize: 100,
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
      ]}
    />
  );
}

export function TwoImagesPendingWDownloadProgress(args: Props): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: IMAGE_PNG,
        fileName: 'sax.png',
        path: undefined,
        pending: true,
        size: 1000000,
        totalDownloaded: 300000,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
      fakeAttachment({
        contentType: IMAGE_PNG,
        fileName: 'sax.png',
        path: undefined,
        pending: true,
        size: 1000000,
        totalDownloaded: 300000,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function ThreeImages(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          width: 3000,
        }),
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
      ]}
    />
  );
}

export function ThreeImagesPendingWDownloadProgress(args: Props): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: IMAGE_PNG,
        fileName: 'sax.png',
        path: undefined,
        pending: true,
        size: 1000000,
        totalDownloaded: 300000,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function ThreeImagesNotDownloaded(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'sax.png',
          height: 1200,
          width: 800,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
      ]}
    />
  );
}

export function FourImages(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          width: 3000,
        }),
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          width: 3000,
        }),
      ]}
    />
  );
}

export function FourImagesPendingWDownloadProgress(args: Props): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: IMAGE_PNG,
        fileName: 'sax.png',
        path: undefined,
        pending: true,
        size: 1000000,
        totalDownloaded: 300000,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function FourImagesNotDownloaded(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'sax.png',
          height: 1200,
          width: 800,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
      ]}
    />
  );
}

export function FiveImages(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          width: 3000,
        }),
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          width: 3000,
        }),
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
      ]}
    />
  );
}

export function FiveImagesPendingWDownloadProgress(args: Props): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: IMAGE_PNG,
        fileName: 'sax.png',
        path: undefined,
        pending: true,
        size: 1000000,
        totalDownloaded: 300000,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function FiveImagesNotDownloaded(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'sax.png',
          height: 1200,
          width: 800,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
      ]}
    />
  );
}

export const _6Images = (args: Props): JSX.Element => {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          width: 3000,
        }),
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          width: 3000,
        }),
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
      ]}
    />
  );
};

export function _6ImagesPendingWDownloadProgress(args: Props): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: IMAGE_PNG,
        fileName: 'sax.png',
        path: undefined,
        pending: true,
        size: 1000000,
        totalDownloaded: 300000,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        height: 1680,
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        width: 3000,
      }),
      fakeAttachment({
        contentType: IMAGE_PNG,
        fileName: 'sax.png',
        path: undefined,
        pending: true,
        size: 1000000,
        totalDownloaded: 300000,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function _6ImagesOneIncrementalNeedDownload(args: Props): JSX.Element {
  const props = {
    ...args,
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        fileName: 'sax.png',
        path: undefined,
        incrementalMac: 'something',
        chunkSize: 100,
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        url: undefined,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        height: 1680,
        url: undefined,
        width: 3000,
        path: undefined,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        height: 1680,
        url: undefined,
        width: 3000,
        path: undefined,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        height: 1680,
        url: undefined,
        width: 3000,
        path: undefined,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        height: 1680,
        url: undefined,
        width: 3000,
        path: undefined,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        height: 1680,
        url: undefined,
        width: 3000,
        path: undefined,
      }),
    ],
  };

  return <ImageGrid {...props} />;
}

export function MixedContentTypes(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'pixabay-Soap-Bubble-7141.mp4',
          height: 112,
          screenshot: {
            height: 112,
            width: 112,
            url: '/fixtures/kitten-4-112-112.jpg',
            contentType: IMAGE_JPEG,
            path: 'originalpath',
          },
          url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
          width: 112,
        }),
        fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'sax.png',
          height: 1200,
          url: pngUrl,
          width: 800,
        }),
        fakeAttachment({
          contentType: stringToMIMEType('text/plain'),
          fileName: 'lorem-ipsum.txt',
          url: '/fixtures/lorem-ipsum.txt',
        }),
        fakeAttachment({
          contentType: AUDIO_MP3,
          fileName: 'incompetech-com-Agnus-Dei-X.mp3',
          url: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
        }),
      ]}
    />
  );
}

export function EightImagesNotDownloaded(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'sax.png',
          height: 1200,
          width: 800,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
        fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          height: 1680,
          width: 3000,
          path: undefined,
          blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        }),
      ]}
    />
  );
}

export function Sticker(args: Props): JSX.Element {
  return (
    <ImageGrid
      {...args}
      attachments={[
        fakeAttachment({
          contentType: IMAGE_WEBP,
          fileName: 'sticker.webp',
          height: 512,
          url: squareStickerUrl,
          width: 512,
        }),
      ]}
      isSticker
      stickerSize={128}
    />
  );
}

export function ContentAboveAndBelow(args: Props): JSX.Element {
  return <ImageGrid {...args} withContentAbove withContentBelow />;
}

export function BottomOverlay(args: Props): JSX.Element {
  return <ImageGrid {...args} bottomOverlay />;
}
