// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './AttachmentSection.dom.js';
import { AttachmentSection } from './AttachmentSection.dom.js';
import {
  createRandomDocuments,
  createRandomMedia,
  createRandomLinks,
  createRandomAudio,
  days,
} from './utils/mocks.std.js';
import { MediaItem } from './utils/storybook.dom.js';

export default {
  title: 'Components/Conversation/MediaGallery/AttachmentSection',
  component: AttachmentSection,
  argTypes: {
    header: { control: { type: 'text' } },
  },
  args: {
    header: 'Today',
    mediaItems: [],
    renderMediaItem: props => <MediaItem {...props} />,
    onItemClick: action('onItemClick'),
  },
} satisfies Meta<Props>;

export function Documents(args: Props): React.JSX.Element {
  const mediaItems = createRandomDocuments(Date.now(), days(1));
  return <AttachmentSection {...args} mediaItems={mediaItems} />;
}

export function Media(args: Props): React.JSX.Element {
  const mediaItems = createRandomMedia(Date.now(), days(1));
  return <AttachmentSection {...args} mediaItems={mediaItems} />;
}

export function Audio(args: Props): React.JSX.Element {
  const mediaItems = createRandomAudio(Date.now(), days(1));
  return <AttachmentSection {...args} mediaItems={mediaItems} />;
}

export function Links(args: Props): React.JSX.Element {
  const mediaItems = createRandomLinks(Date.now(), days(1));
  return <AttachmentSection {...args} mediaItems={mediaItems} />;
}
