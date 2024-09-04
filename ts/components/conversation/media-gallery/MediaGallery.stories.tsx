// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { Props } from './MediaGallery';
import { MediaGallery } from './MediaGallery';
import {
  createPreparedMediaItems,
  createRandomDocuments,
  createRandomMedia,
  days,
} from './utils/mocks';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/MediaGallery/MediaGallery',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,

  conversationId: '123',
  documents: overrideProps.documents || [],
  haveOldestDocument: overrideProps.haveOldestDocument || false,
  haveOldestMedia: overrideProps.haveOldestMedia || false,
  loading: overrideProps.loading || false,
  media: overrideProps.media || [],

  initialLoad: action('initialLoad'),
  loadMoreDocuments: action('loadMoreDocuments'),
  loadMoreMedia: action('loadMoreMedia'),
  saveAttachment: action('saveAttachment'),
  showLightbox: action('showLightbox'),
});

export function Populated(): JSX.Element {
  const documents = createRandomDocuments(Date.now(), days(1)).slice(0, 1);
  const media = createPreparedMediaItems(createRandomMedia);
  const props = createProps({ documents, media });

  return <MediaGallery {...props} />;
}

export function NoDocuments(): JSX.Element {
  const media = createPreparedMediaItems(createRandomMedia);
  const props = createProps({ media });

  return <MediaGallery {...props} />;
}

export function NoMedia(): JSX.Element {
  const documents = createPreparedMediaItems(createRandomDocuments);
  const props = createProps({ documents });

  return <MediaGallery {...props} />;
}

export function OneEach(): JSX.Element {
  const media = createRandomMedia(Date.now(), days(1)).slice(0, 1);
  const documents = createRandomDocuments(Date.now(), days(1)).slice(0, 1);

  const props = createProps({ documents, media });

  return <MediaGallery {...props} />;
}

export function Empty(): JSX.Element {
  const props = createProps();

  return <MediaGallery {...props} />;
}
