// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './AudioListItem.dom.js';
import { AudioListItem } from './AudioListItem.dom.js';
import {
  createPreparedMediaItems,
  createRandomAudio,
} from './utils/mocks.std.js';

export default {
  title: 'Components/Conversation/MediaGallery/AudioListItem',
} satisfies Meta<Props>;

const { i18n } = window.SignalContext;

export function Multiple(): JSX.Element {
  const items = createPreparedMediaItems(createRandomAudio);

  return (
    <>
      {items.map((mediaItem, index) => (
        <AudioListItem
          i18n={i18n}
          key={index}
          mediaItem={mediaItem}
          isPlayed={Math.random() > 0.5}
          authorTitle="Alice"
          onClick={action('onClick')}
          onShowMessage={action('onShowMessage')}
        />
      ))}
    </>
  );
}
