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
    onClick: action('onClick'),
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

export function TwoImages(args: Props): JSX.Element {
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
      ]}
    />
  );
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
