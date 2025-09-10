// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './DocumentListItem';
import { DocumentListItem } from './DocumentListItem';
import { createPreparedMediaItems, createRandomDocuments } from './utils/mocks';

export default {
  title: 'Components/Conversation/MediaGallery/DocumentListItem',
} satisfies Meta<Props>;

export function Multiple(): JSX.Element {
  const items = createPreparedMediaItems(createRandomDocuments);

  return (
    <>
      {items.map(mediaItem => (
        <DocumentListItem
          key={mediaItem.attachment.fileName}
          mediaItem={mediaItem}
          onClick={action('onClick')}
        />
      ))}
    </>
  );
}
