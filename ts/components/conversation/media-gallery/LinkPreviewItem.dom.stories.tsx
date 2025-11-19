// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './LinkPreviewItem.dom.js';
import { LinkPreviewItem } from './LinkPreviewItem.dom.js';
import {
  createPreparedMediaItems,
  createRandomLinks,
} from './utils/mocks.std.js';

export default {
  title: 'Components/Conversation/MediaGallery/LinkPreviewItem',
} satisfies Meta<Props>;

const { i18n } = window.SignalContext;

export function Multiple(): JSX.Element {
  const items = createPreparedMediaItems(createRandomLinks);

  return (
    <>
      {items.map((mediaItem, index) => (
        <LinkPreviewItem
          i18n={i18n}
          key={index}
          authorTitle="Alice"
          mediaItem={mediaItem}
          onClick={action('onClick')}
          onShowMessage={action('onShowMessage')}
        />
      ))}
    </>
  );
}
