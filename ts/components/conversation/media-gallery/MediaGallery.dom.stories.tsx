// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { MediaTabType } from '../../../types/MediaItem.std.js';
import type { Props } from './MediaGallery.dom.js';
import { MediaGallery } from './MediaGallery.dom.js';
import { PanelHeader } from './PanelHeader.dom.js';
import {
  createPreparedMediaItems,
  createRandomDocuments,
  createRandomMedia,
  createRandomAudio,
  createRandomLinks,
  days,
} from './utils/mocks.std.js';
import { MediaItem } from './utils/storybook.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/MediaGallery/MediaGallery',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,

  conversationId: '123',
  haveOldestMedia: overrideProps.haveOldestMedia || false,
  haveOldestAudio: overrideProps.haveOldestAudio || false,
  haveOldestLink: overrideProps.haveOldestLink || false,
  haveOldestDocument: overrideProps.haveOldestDocument || false,
  loading: overrideProps.loading || false,

  media: overrideProps.media || [],
  audio: overrideProps.audio || [],
  links: overrideProps.links || [],
  documents: overrideProps.documents || [],
  tab: overrideProps.tab || 'media',

  initialLoad: action('initialLoad'),
  loadMore: action('loadMore'),
  saveAttachment: action('saveAttachment'),
  playAudio: action('playAudio'),
  showLightbox: action('showLightbox'),
  kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
  cancelAttachmentDownload: action('cancelAttachmentDownload'),

  renderMediaItem: props => <MediaItem {...props} />,
});

function Panel(props: Props): JSX.Element {
  const [tab, setTab] = useState<MediaTabType>(props.tab);

  const [loading, setLoading] = useState(false);

  const { loadMore: givenLoadMore } = props;

  const loadMore = useCallback(
    (...args: Parameters<typeof givenLoadMore>) => {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 250);
      return givenLoadMore(...args);
    },
    [givenLoadMore]
  );

  return (
    <div>
      <PanelHeader i18n={i18n} tab={tab} setTab={setTab} />
      <MediaGallery
        {...props}
        tab={tab}
        loading={loading}
        loadMore={loadMore}
      />
    </div>
  );
}

export function Populated(): JSX.Element {
  const documents = createRandomDocuments(Date.now() - days(5), days(5));
  const media = createPreparedMediaItems(createRandomMedia);
  const props = createProps({ documents, media });

  return <Panel {...props} />;
}

export function NoDocuments(): JSX.Element {
  const media = createPreparedMediaItems(createRandomMedia);
  const props = createProps({ media, haveOldestDocument: true });

  return <Panel {...props} />;
}

export function NoMedia(): JSX.Element {
  const documents = createPreparedMediaItems(createRandomDocuments);
  const props = createProps({ documents, haveOldestMedia: true });

  return <Panel {...props} />;
}

export function OneEach(): JSX.Element {
  const media = createRandomMedia(Date.now(), days(1)).slice(0, 1);
  const audio = createRandomAudio(Date.now(), days(1)).slice(0, 1);
  const documents = createRandomDocuments(Date.now(), days(1)).slice(0, 1);
  const links = createRandomLinks(Date.now(), days(1)).slice(0, 1);

  const props = createProps({ documents, audio, media, links });

  return <Panel {...props} />;
}

export function Empty(): JSX.Element {
  const props = createProps({
    haveOldestMedia: true,
    haveOldestAudio: true,
    haveOldestDocument: true,
    haveOldestLink: true,
  });

  return <Panel {...props} />;
}
