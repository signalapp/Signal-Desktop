// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type {
  AttachmentDraftType,
  AttachmentType,
} from '../../types/Attachment';
import type { Props } from './AttachmentList';
import { AttachmentList } from './AttachmentList';
import {
  AUDIO_MP3,
  IMAGE_GIF,
  IMAGE_JPEG,
  VIDEO_MP4,
  stringToMIMEType,
} from '../../types/MIME';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { fakeDraftAttachment } from '../../test-both/helpers/fakeAttachment';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/AttachmentList',
} satisfies Meta<Props<AttachmentDraftType | AttachmentType>>;

const createProps = (
  overrideProps: Partial<Props<AttachmentDraftType>> = {}
): Props<AttachmentDraftType> => ({
  attachments: overrideProps.attachments || [],
  i18n,
  onAddAttachment: action('onAddAttachment'),
  onClickAttachment: action('onClickAttachment'),
  onClose: action('onClose'),
  onCloseAttachment: action('onCloseAttachment'),
});

export function OneFile(): JSX.Element {
  const props = createProps({
    attachments: [
      fakeDraftAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
      }),
    ],
  });
  return <AttachmentList {...props} />;
}

export function MultipleVisualAttachments(): JSX.Element {
  const props = createProps({
    attachments: [
      fakeDraftAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
      }),
      fakeDraftAttachment({
        contentType: VIDEO_MP4,
        fileName: 'pixabay-Soap-Bubble-7141.mp4',
        url: '/fixtures/kitten-4-112-112.jpg',
        screenshotPath: '/fixtures/kitten-4-112-112.jpg',
      }),
      fakeDraftAttachment({
        contentType: IMAGE_GIF,
        fileName: 'giphy-GVNv0UpeYm17e',
        url: '/fixtures/giphy-GVNvOUpeYmI7e.gif',
      }),
    ],
  });

  return <AttachmentList {...props} />;
}

export function MultipleWithNonVisualTypes(): JSX.Element {
  const props = createProps({
    attachments: [
      fakeDraftAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'tina-rolf-269345-unsplash.jpg',
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
      }),
      fakeDraftAttachment({
        contentType: stringToMIMEType('text/plain'),
        fileName: 'lorem-ipsum.txt',
        url: '/fixtures/lorem-ipsum.txt',
      }),
      fakeDraftAttachment({
        contentType: AUDIO_MP3,
        fileName: 'incompetech-com-Agnus-Dei-X.mp3',
        url: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
      }),
      fakeDraftAttachment({
        contentType: VIDEO_MP4,
        fileName: 'pixabay-Soap-Bubble-7141.mp4',
        url: '/fixtures/kitten-4-112-112.jpg',
        screenshotPath: '/fixtures/kitten-4-112-112.jpg',
      }),
      fakeDraftAttachment({
        contentType: IMAGE_GIF,
        fileName: 'giphy-GVNv0UpeYm17e',
        url: '/fixtures/giphy-GVNvOUpeYmI7e.gif',
      }),
    ],
  });

  return <AttachmentList {...props} />;
}

export function EmptyList(): JSX.Element {
  const props = createProps();

  return <AttachmentList {...props} />;
}
