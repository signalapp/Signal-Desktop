// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useCallback } from 'react';

import moment from 'moment';

import type { ItemClickEvent } from './types/ItemClickEvent.std.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import type {
  LinkPreviewMediaItemType,
  MediaItemType,
  GenericMediaItemType,
} from '../../../types/MediaItem.std.js';
import type { SaveAttachmentActionCreatorType } from '../../../state/ducks/conversations.preload.js';
import { AttachmentSection } from './AttachmentSection.dom.js';
import { EmptyState } from './EmptyState.dom.js';
import { Tabs } from '../../Tabs.dom.js';
import { TabViews } from './types/TabViews.std.js';
import { groupMediaItemsByDate } from './groupMediaItemsByDate.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import { openLinkInWebBrowser } from '../../../util/openLinkInWebBrowser.dom.js';
import { usePrevious } from '../../../hooks/usePrevious.std.js';
import type { AttachmentForUIType } from '../../../types/Attachment.std.js';
import { tw } from '../../../axo/tw.dom.js';

export type Props = {
  conversationId: string;
  i18n: LocalizerType;
  haveOldestMedia: boolean;
  haveOldestAudio: boolean;
  haveOldestLink: boolean;
  haveOldestDocument: boolean;
  loading: boolean;
  initialLoad: (id: string) => unknown;
  loadMore: (
    id: string,
    type: 'media' | 'audio' | 'documents' | 'links'
  ) => unknown;
  media: ReadonlyArray<MediaItemType>;
  audio: ReadonlyArray<MediaItemType>;
  documents: ReadonlyArray<MediaItemType>;
  links: ReadonlyArray<LinkPreviewMediaItemType>;
  saveAttachment: SaveAttachmentActionCreatorType;
  kickOffAttachmentDownload: (options: { messageId: string }) => void;
  cancelAttachmentDownload: (options: { messageId: string }) => void;
  playAudio: (attachment: MediaItemType) => void;
  showLightbox: (options: {
    attachment: AttachmentForUIType;
    messageId: string;
  }) => void;

  renderMiniPlayer: () => JSX.Element;
  renderMediaItem: (props: {
    onItemClick: (event: ItemClickEvent) => unknown;
    mediaItem: GenericMediaItemType;
  }) => JSX.Element;
};

const MONTH_FORMAT = 'MMMM YYYY';

function MediaSection({
  i18n,
  loading,
  tab,
  mediaItems,
  saveAttachment,
  kickOffAttachmentDownload,
  cancelAttachmentDownload,
  showLightbox,
  playAudio,
  renderMediaItem,
}: Pick<
  Props,
  | 'i18n'
  | 'loading'
  | 'saveAttachment'
  | 'kickOffAttachmentDownload'
  | 'cancelAttachmentDownload'
  | 'showLightbox'
  | 'playAudio'
  | 'renderMediaItem'
> & {
  tab: TabViews;
  mediaItems: ReadonlyArray<GenericMediaItemType>;
}): JSX.Element {
  const onItemClick = useCallback(
    (event: ItemClickEvent) => {
      const { state, mediaItem } = event;
      const { message } = mediaItem;
      if (state === 'Downloading') {
        cancelAttachmentDownload({ messageId: message.id });
        return;
      }
      if (state === 'NeedsDownload') {
        kickOffAttachmentDownload({ messageId: message.id });
        return;
      }
      if (state !== 'ReadyToShow') {
        throw missingCaseError(state);
      }

      if (mediaItem.type === 'media') {
        showLightbox({
          attachment: mediaItem.attachment,
          messageId: message.id,
        });
      } else if (mediaItem.type === 'document') {
        saveAttachment(mediaItem.attachment, message.sentAt);
      } else if (mediaItem.type === 'link') {
        openLinkInWebBrowser(mediaItem.preview.url);
      } else if (mediaItem.type === 'audio') {
        playAudio(mediaItem);
      } else {
        throw missingCaseError(mediaItem.type);
      }
    },
    [
      saveAttachment,
      showLightbox,
      cancelAttachmentDownload,
      kickOffAttachmentDownload,
      playAudio,
    ]
  );

  if (mediaItems.length === 0) {
    if (loading) {
      return <div />;
    }

    return <EmptyState i18n={i18n} tab={tab} />;
  }

  const now = Date.now();
  const sections = groupMediaItemsByDate(now, mediaItems).map(section => {
    const first = section.mediaItems[0];
    const { message } = first;
    const date = moment(message.receivedAtMs || message.receivedAt);

    function getHeader(): string {
      switch (section.type) {
        case 'yearMonth':
          return date.format(MONTH_FORMAT);
        case 'today':
          return i18n('icu:today');
        case 'yesterday':
          return i18n('icu:yesterday');
        case 'thisWeek':
          return i18n('icu:thisWeek');
        case 'thisMonth':
          return i18n('icu:thisMonth');
        default:
          throw missingCaseError(section);
      }
    }

    const header = getHeader();

    return (
      <AttachmentSection
        key={header}
        header={header}
        mediaItems={section.mediaItems}
        onItemClick={onItemClick}
        renderMediaItem={renderMediaItem}
      />
    );
  });

  const isGrid = mediaItems.at(0)?.type === 'media';

  return (
    <div
      className={tw(
        'flex min-w-0 grow flex-col',
        isGrid ? undefined : 'divide-y'
      )}
    >
      {sections}
    </div>
  );
}

export function MediaGallery({
  conversationId,
  haveOldestMedia,
  haveOldestAudio,
  haveOldestLink,
  haveOldestDocument,
  i18n,
  initialLoad,
  loading,
  loadMore,
  media,
  audio,
  links,
  documents,
  saveAttachment,
  kickOffAttachmentDownload,
  cancelAttachmentDownload,
  playAudio,
  showLightbox,
  renderMediaItem,
  renderMiniPlayer,
}: Props): JSX.Element {
  const focusRef = useRef<HTMLDivElement | null>(null);
  const scrollObserverRef = useRef<HTMLDivElement | null>(null);
  const intersectionObserver = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<boolean>(false);
  const tabViewRef = useRef<TabViews>(TabViews.Media);

  useEffect(() => {
    focusRef.current?.focus();
  }, []);

  useEffect(() => {
    if (
      media.length > 0 ||
      audio.length > 0 ||
      links.length > 0 ||
      documents.length > 0 ||
      haveOldestMedia ||
      haveOldestAudio ||
      haveOldestLink ||
      haveOldestDocument
    ) {
      return;
    }
    initialLoad(conversationId);
    loadingRef.current = true;
  }, [
    conversationId,
    haveOldestMedia,
    haveOldestDocument,
    haveOldestAudio,
    haveOldestLink,
    initialLoad,
    media.length,
    audio.length,
    links.length,
    documents.length,
  ]);

  const previousLoading = usePrevious(loading, loading);
  if (previousLoading && !loading) {
    loadingRef.current = false;
  }

  useEffect(() => {
    if (loading || !scrollObserverRef.current) {
      return;
    }

    intersectionObserver.current?.disconnect();
    intersectionObserver.current = null;

    intersectionObserver.current = new IntersectionObserver(
      (entries: ReadonlyArray<IntersectionObserverEntry>) => {
        if (loadingRef.current) {
          return;
        }

        const entry = entries.find(
          item => item.target === scrollObserverRef.current
        );

        if (entry && entry.intersectionRatio > 0) {
          if (tabViewRef.current === TabViews.Media) {
            if (!haveOldestMedia) {
              loadMore(conversationId, 'media');
              loadingRef.current = true;
            }
          } else if (tabViewRef.current === TabViews.Audio) {
            if (!haveOldestMedia) {
              loadMore(conversationId, 'audio');
              loadingRef.current = true;
            }
          } else if (tabViewRef.current === TabViews.Documents) {
            if (!haveOldestDocument) {
              loadMore(conversationId, 'documents');
              loadingRef.current = true;
            }
          } else if (tabViewRef.current === TabViews.Links) {
            if (!haveOldestLink) {
              loadMore(conversationId, 'links');
              loadingRef.current = true;
            }
          } else {
            throw missingCaseError(tabViewRef.current);
          }
        }
      }
    );
    intersectionObserver.current.observe(scrollObserverRef.current);

    return () => {
      intersectionObserver.current?.disconnect();
      intersectionObserver.current = null;
    };
  }, [
    conversationId,
    haveOldestDocument,
    haveOldestMedia,
    haveOldestLink,
    loading,
    loadMore,
  ]);

  return (
    <div className="module-media-gallery" tabIndex={-1} ref={focusRef}>
      <Tabs
        initialSelectedTab={TabViews.Media}
        tabs={[
          {
            id: TabViews.Media,
            label: i18n('icu:media'),
          },
          {
            id: TabViews.Audio,
            label: i18n('icu:MediaGallery__tab__audio'),
          },
          {
            id: TabViews.Links,
            label: i18n('icu:MediaGallery__tab__links'),
          },
          {
            id: TabViews.Documents,
            label: i18n('icu:MediaGallery__tab__files'),
          },
        ]}
      >
        {({ selectedTab }) => {
          let mediaItems: ReadonlyArray<GenericMediaItemType>;

          if (selectedTab === TabViews.Media) {
            tabViewRef.current = TabViews.Media;
            mediaItems = media;
          } else if (selectedTab === TabViews.Audio) {
            tabViewRef.current = TabViews.Audio;
            mediaItems = audio;
          } else if (selectedTab === TabViews.Documents) {
            tabViewRef.current = TabViews.Documents;
            mediaItems = documents;
          } else if (selectedTab === TabViews.Links) {
            tabViewRef.current = TabViews.Links;
            mediaItems = links;
          } else {
            throw new Error(`Unexpected select tab: ${selectedTab}`);
          }

          return (
            <>
              {renderMiniPlayer()}
              <div className="module-media-gallery__content">
                <MediaSection
                  i18n={i18n}
                  loading={loading}
                  tab={tabViewRef.current}
                  mediaItems={mediaItems}
                  saveAttachment={saveAttachment}
                  showLightbox={showLightbox}
                  kickOffAttachmentDownload={kickOffAttachmentDownload}
                  cancelAttachmentDownload={cancelAttachmentDownload}
                  playAudio={playAudio}
                  renderMediaItem={renderMediaItem}
                />
              </div>
            </>
          );
        }}
      </Tabs>
      <div
        ref={scrollObserverRef}
        className="module-media-gallery__scroll-observer"
      />
    </div>
  );
}
