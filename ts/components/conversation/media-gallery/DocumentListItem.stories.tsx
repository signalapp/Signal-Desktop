// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './DocumentListItem.dom.js';
import { DocumentListItem } from './DocumentListItem.dom.js';
import {
  createPreparedMediaItems,
  createRandomDocuments,
} from './utils/mocks.std.js';

export default {
  title: 'Components/Conversation/MediaGallery/DocumentListItem',
} satisfies Meta<Props>;

const { i18n } = window.SignalContext;

export function Multiple(): JSX.Element {
  const items = createPreparedMediaItems(createRandomDocuments);

  return (
    <>
      {items.map(mediaItem => (
        <DocumentListItem
          i18n={i18n}
          key={mediaItem.attachment.fileName}
          mediaItem={mediaItem}
          onClick={action('onClick')}
        />
      ))}
    </>
  );
}
