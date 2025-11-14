// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './AttachmentSection.dom.js';
import { AttachmentSection } from './AttachmentSection.dom.js';
import { LinkPreviewItem } from './LinkPreviewItem.dom.js';
import {
  createRandomDocuments,
  createRandomMedia,
  days,
} from './utils/mocks.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/MediaGallery/AttachmentSection',
  component: AttachmentSection,
  argTypes: {
    header: { control: { type: 'text' } },
  },
  args: {
    i18n,
    header: 'Today',
    mediaItems: [],
    renderLinkPreviewItem: ({ mediaItem, onClick }) => {
      return (
        <LinkPreviewItem
          i18n={i18n}
          authorTitle="Alice"
          mediaItem={mediaItem}
          onClick={onClick}
        />
      );
    },
    onItemClick: action('onItemClick'),
  },
} satisfies Meta<Props>;

export function Documents(args: Props) {
  const mediaItems = createRandomDocuments(Date.now(), days(1));
  return <AttachmentSection {...args} mediaItems={mediaItems} />;
}

export function Media(args: Props) {
  const mediaItems = createRandomMedia(Date.now(), days(1));
  return <AttachmentSection {...args} mediaItems={mediaItems} />;
}
