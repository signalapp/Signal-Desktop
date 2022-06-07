// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { boolean, number } from '@storybook/addon-knobs';

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
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  attachments: overrideProps.attachments || [
    fakeAttachment({
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      height: 1200,
      url: pngUrl,
      width: 800,
    }),
  ],
  bottomOverlay: boolean('bottomOverlay', overrideProps.bottomOverlay || false),
  direction: overrideProps.direction || 'incoming',
  i18n,
  isSticker: boolean('isSticker', overrideProps.isSticker || false),
  onClick: action('onClick'),
  onError: action('onError'),
  stickerSize: number('stickerSize', overrideProps.stickerSize || 0),
  tabIndex: number('tabIndex', overrideProps.tabIndex || 0),
  withContentAbove: boolean(
    'withContentAbove',
    overrideProps.withContentAbove || false
  ),
  withContentBelow: boolean(
    'withContentBelow',
    overrideProps.withContentBelow || false
  ),
});

export const OneImage = (): JSX.Element => {
  const props = createProps();

  return <ImageGrid {...props} />;
};

export const TwoImages = (): JSX.Element => {
  const props = createProps({
    attachments: [
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
    ],
  });

  return <ImageGrid {...props} />;
};

export const ThreeImages = (): JSX.Element => {
  const props = createProps({
    attachments: [
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
    ],
  });

  return <ImageGrid {...props} />;
};

export const FourImages = (): JSX.Element => {
  const props = createProps({
    attachments: [
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
    ],
  });

  return <ImageGrid {...props} />;
};

export const FiveImages = (): JSX.Element => {
  const props = createProps({
    attachments: [
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
    ],
  });

  return <ImageGrid {...props} />;
};

export const _6Images = (): JSX.Element => {
  const props = createProps({
    attachments: [
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
    ],
  });

  return <ImageGrid {...props} />;
};

_6Images.story = {
  name: '6+ Images',
};

export const MixedContentTypes = (): JSX.Element => {
  const props = createProps({
    attachments: [
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
    ],
  });

  return <ImageGrid {...props} />;
};

export const Sticker = (): JSX.Element => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: IMAGE_WEBP,
        fileName: 'sticker.webp',
        height: 512,
        url: squareStickerUrl,
        width: 512,
      }),
    ],
    isSticker: true,
    stickerSize: 128,
  });

  return <ImageGrid {...props} />;
};

export const ContentAboveAndBelow = (): JSX.Element => {
  const props = createProps({
    withContentAbove: true,
    withContentBelow: true,
  });

  return <ImageGrid {...props} />;
};

ContentAboveAndBelow.story = {
  name: 'Content Above and Below',
};

export const BottomOverlay = (): JSX.Element => {
  const props = createProps({
    bottomOverlay: true,
  });

  return <ImageGrid {...props} />;
};
