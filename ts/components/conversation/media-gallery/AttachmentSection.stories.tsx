// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { Props } from './AttachmentSection';
import { AttachmentSection } from './AttachmentSection';
import { createRandomDocuments, createRandomMedia, days } from './utils/mocks';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/MediaGallery/AttachmentSection',
  component: AttachmentSection,
  argTypes: {
    header: { control: { type: 'text' } },
    type: {
      control: {
        type: 'select',
        options: ['media', 'documents'],
      },
    },
  },
  args: {
    i18n,
    header: 'Today',
    type: 'media',
    mediaItems: [],
    onItemClick: action('onItemClick'),
  },
} satisfies Meta<Props>;

export function Documents(args: Props) {
  const mediaItems = createRandomDocuments(Date.now(), days(1));
  return (
    <AttachmentSection {...args} type="documents" mediaItems={mediaItems} />
  );
}

export function Media(args: Props) {
  const mediaItems = createRandomMedia(Date.now(), days(1));
  return <AttachmentSection {...args} type="media" mediaItems={mediaItems} />;
}
