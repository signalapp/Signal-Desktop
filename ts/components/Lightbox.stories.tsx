// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import { noop } from 'lodash';
import type { Meta } from '@storybook/react';
import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './Lightbox';
import { Lightbox } from './Lightbox';
import type { MediaItemType } from '../types/MediaItem';
import { setupI18n } from '../util/setupI18n';
import {
  AUDIO_MP3,
  IMAGE_JPEG,
  VIDEO_MP4,
  VIDEO_QUICKTIME,
  stringToMIMEType,
} from '../types/MIME';

import { fakeAttachment } from '../test-both/helpers/fakeAttachment';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Lightbox',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

type OverridePropsMediaItemType = Partial<MediaItemType> & { caption?: string };

function createMediaItem(
  overrideProps: OverridePropsMediaItemType
): MediaItemType {
  return {
    attachment: fakeAttachment({
      caption: overrideProps.caption || '',
      contentType: IMAGE_JPEG,
      fileName: overrideProps.objectURL,
      url: overrideProps.objectURL,
    }),
    contentType: IMAGE_JPEG,
    index: 0,
    message: {
      attachments: [],
      conversationId: '1234',
      id: 'image-msg',
      receivedAt: 0,
      receivedAtMs: Date.now(),
      sentAt: Date.now(),
    },
    objectURL: '',
    ...overrideProps,
  };
}

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [selectedIndex, setSelectedIndex] = useState(0);
  const media = overrideProps.media || [];
  return {
    closeLightbox: action('closeLightbox'),
    i18n,
    isViewOnce: Boolean(overrideProps.isViewOnce),
    media,
    saveAttachment: action('saveAttachment'),
    selectedIndex,
    playbackDisabled: false,
    toggleForwardMessagesModal: action('toggleForwardMessagesModal'),
    onMediaPlaybackStart: noop,
    onPrevAttachment: () => {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    },
    onNextAttachment: () => {
      setSelectedIndex(Math.min(media.length - 1, selectedIndex + 1));
    },
    onSelectAttachment: setSelectedIndex,
  };
};

export function Multimedia(): JSX.Element {
  const props = createProps({
    media: [
      {
        attachment: fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          caption:
            'Still from The Lighthouse, starring Robert Pattinson and Willem Defoe.',
        }),
        contentType: IMAGE_JPEG,
        index: 0,
        message: {
          attachments: [],
          conversationId: '1234',
          id: 'image-msg',
          receivedAt: 1,
          receivedAtMs: Date.now(),
          sentAt: Date.now(),
        },
        objectURL: '/fixtures/tina-rolf-269345-unsplash.jpg',
      },
      {
        attachment: fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'pixabay-Soap-Bubble-7141.mp4',
          url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
        }),
        contentType: VIDEO_MP4,
        index: 1,
        message: {
          attachments: [],
          conversationId: '1234',
          id: 'video-msg',
          receivedAt: 2,
          receivedAtMs: Date.now(),
          sentAt: Date.now(),
        },
        objectURL: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
      },
      createMediaItem({
        contentType: IMAGE_JPEG,
        index: 2,
        thumbnailObjectUrl: '/fixtures/kitten-1-64-64.jpg',
        objectURL: '/fixtures/kitten-1-64-64.jpg',
      }),
      createMediaItem({
        contentType: IMAGE_JPEG,
        index: 3,
        thumbnailObjectUrl: '/fixtures/kitten-2-64-64.jpg',
        objectURL: '/fixtures/kitten-2-64-64.jpg',
      }),
    ],
  });

  return <Lightbox {...props} />;
}

export function MissingMedia(): JSX.Element {
  const props = createProps({
    media: [
      {
        attachment: fakeAttachment({
          contentType: IMAGE_JPEG,
          fileName: 'tina-rolf-269345-unsplash.jpg',
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        }),
        contentType: IMAGE_JPEG,
        index: 0,
        message: {
          attachments: [],
          conversationId: '1234',
          id: 'image-msg',
          receivedAt: 3,
          receivedAtMs: Date.now(),
          sentAt: Date.now(),
        },
        objectURL: undefined,
      },
    ],
  });

  return <Lightbox {...props} />;
}

export function SingleImage(): JSX.Element {
  return (
    <Lightbox
      {...createProps({
        media: [
          createMediaItem({
            objectURL: '/fixtures/tina-rolf-269345-unsplash.jpg',
          }),
        ],
      })}
    />
  );
}

export function ImageWithCaptionNormalImage(): JSX.Element {
  return (
    <Lightbox
      {...createProps({
        media: [
          createMediaItem({
            caption:
              'This lighthouse is really cool because there are lots of rocks and there is a tower that has a light and the light is really bright because it shines so much. The day was super duper cloudy and stormy and you can see all the waves hitting against the rocks. Wait? What is that weird red hose line thingy running all the way to the tower? Those rocks look slippery! I bet that water is really cold. I am cold now, can I get a sweater? I wonder where this place is, probably somewhere cold like Coldsgar, Frozenville.',
            objectURL: '/fixtures/tina-rolf-269345-unsplash.jpg',
          }),
        ],
      })}
    />
  );
}

export function ImageWithCaptionAllWhiteImage(): JSX.Element {
  return (
    <Lightbox
      {...createProps({
        media: [
          createMediaItem({
            caption:
              'This is the user-provided caption. It should be visible on light backgrounds.',
            objectURL: '/fixtures/2000x2000-white.png',
          }),
        ],
      })}
    />
  );
}

export function SingleVideo(): JSX.Element {
  return (
    <Lightbox
      {...createProps({
        media: [
          createMediaItem({
            contentType: VIDEO_MP4,
            objectURL: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
          }),
        ],
      })}
    />
  );
}

export function SingleVideoWCaption(): JSX.Element {
  return (
    <Lightbox
      {...createProps({
        media: [
          createMediaItem({
            caption:
              'This is the user-provided caption. It can get long and wrap onto multiple lines.',
            contentType: VIDEO_MP4,
            objectURL: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
          }),
        ],
      })}
    />
  );
}

export function UnsupportedImageType(): JSX.Element {
  return (
    <Lightbox
      {...createProps({
        media: [
          createMediaItem({
            contentType: stringToMIMEType('image/tiff'),
            objectURL: 'unsupported-image.tiff',
          }),
        ],
      })}
    />
  );
}

export function UnsupportedVideoType(): JSX.Element {
  return (
    <Lightbox
      {...createProps({
        media: [
          createMediaItem({
            contentType: VIDEO_QUICKTIME,
            objectURL: 'unsupported-video.mov',
          }),
        ],
      })}
    />
  );
}

export function UnsupportedContent(): JSX.Element {
  return (
    <Lightbox
      {...createProps({
        media: [
          createMediaItem({
            contentType: AUDIO_MP3,
            objectURL: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
          }),
        ],
      })}
    />
  );
}

export function CustomChildren(): JSX.Element {
  return (
    <Lightbox {...createProps({})} media={[]}>
      <div
        style={{
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        I am middle child
      </div>
    </Lightbox>
  );
}

export function ConversationHeader(): JSX.Element {
  return (
    <Lightbox
      {...createProps({})}
      getConversation={() => ({
        acceptedMessageRequest: true,
        avatarUrl: '/fixtures/kitten-1-64-64.jpg',
        badges: [],
        id: '1234',
        isMe: false,
        name: 'Test',
        profileName: 'Test',
        sharedGroupNames: [],
        title: 'Test',
        type: 'direct',
      })}
      media={[
        createMediaItem({
          contentType: VIDEO_MP4,
          objectURL: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
        }),
      ]}
    />
  );
}

export function ViewOnceVideo(): JSX.Element {
  return (
    <Lightbox
      {...createProps({
        isViewOnce: true,
        media: [
          createMediaItem({
            contentType: VIDEO_MP4,
            objectURL: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
          }),
        ],
      })}
      isViewOnce
    />
  );
}

export function IncrementalVideo(): JSX.Element {
  const item = createMediaItem({
    contentType: VIDEO_MP4,
    objectURL: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
  });

  return (
    <Lightbox
      {...createProps({
        media: [
          {
            ...item,
            attachment: {
              ...item.attachment,
              incrementalMac: 'something',
              chunkSize: 42,
              pending: true,
              totalDownloaded: 50000,
              size: 100000,
            },
          },
        ],
      })}
    />
  );
}
