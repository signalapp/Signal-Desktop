// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './ContactListItem.dom.js';
import { ContactListItem } from './ContactListItem.dom.js';
import {
  createPreparedMediaItems,
  createRandomContacts,
} from './utils/mocks.std.js';

export default {
  title: 'Components/Conversation/MediaGallery/ContactListItem',
} satisfies Meta<Props>;

const { i18n } = window.SignalContext;

export function Multiple(): React.JSX.Element {
  const items = createPreparedMediaItems(createRandomContacts);

  return (
    <>
      {items.map((mediaItem, index) => (
        <ContactListItem
          i18n={i18n}
          key={index}
          mediaItem={mediaItem}
          authorTitle="Alice"
          onClick={action('onClick')}
          onShowMessage={action('onShowMessage')}
        />
      ))}
    </>
  );
}
