// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { number } from '@storybook/addon-knobs';

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
};

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
      received_at: 0,
      received_at_ms: Date.now(),
      sent_at: Date.now(),
    },
    objectURL: '',
    ...overrideProps,
  };
}

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  close: action('close'),
  i18n,
  isViewOnce: Boolean(overrideProps.isViewOnce),
  media: overrideProps.media || [],
  onSave: action('onSave'),
  selectedIndex: number('selectedIndex', overrideProps.selectedIndex || 0),
});

export const Multimedia = (): JSX.Element => {
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
          received_at: 1,
          received_at_ms: Date.now(),
          sent_at: Date.now(),
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
          received_at: 2,
          received_at_ms: Date.now(),
          sent_at: Date.now(),
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
};

export const MissingMedia = (): JSX.Element => {
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
          received_at: 3,
          received_at_ms: Date.now(),
          sent_at: Date.now(),
        },
        objectURL: undefined,
      },
    ],
  });

  return <Lightbox {...props} />;
};

export const SingleImage = (): JSX.Element => (
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

export const ImageWithCaptionNormalImage = (): JSX.Element => (
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

ImageWithCaptionNormalImage.story = {
  name: 'Image with Caption (normal image)',
};

export const ImageWithCaptionAllWhiteImage = (): JSX.Element => (
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

ImageWithCaptionAllWhiteImage.story = {
  name: 'Image with Caption (all-white image)',
};

export const SingleVideo = (): JSX.Element => (
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

export const SingleVideoWCaption = (): JSX.Element => (
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

SingleVideoWCaption.story = {
  name: 'Single Video w/caption',
};

export const UnsupportedImageType = (): JSX.Element => (
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

export const UnsupportedVideoType = (): JSX.Element => (
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

export const UnsupportedContent = (): JSX.Element => (
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

export const CustomChildren = (): JSX.Element => (
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

CustomChildren.story = {
  name: 'Custom children',
};

export const Forwarding = (): JSX.Element => (
  <Lightbox {...createProps({})} onForward={action('onForward')} />
);

export const ConversationHeader = (): JSX.Element => (
  <Lightbox
    {...createProps({})}
    getConversation={() => ({
      acceptedMessageRequest: true,
      avatarPath: '/fixtures/kitten-1-64-64.jpg',
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

export const ViewOnceVideo = (): JSX.Element => (
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
