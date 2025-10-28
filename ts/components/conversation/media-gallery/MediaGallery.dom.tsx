// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef } from 'react';

import moment from 'moment';

import type { ItemClickEvent } from './types/ItemClickEvent.std.js';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.js';
import type { MediaItemType } from '../../../types/MediaItem.std.js';
import type { SaveAttachmentActionCreatorType } from '../../../state/ducks/conversations.preload.js';
import { AttachmentSection } from './AttachmentSection.dom.js';
import { EmptyState } from './EmptyState.dom.js';
import { Tabs } from '../../Tabs.dom.js';
import { groupMediaItemsByDate } from './groupMediaItemsByDate.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import { usePrevious } from '../../../hooks/usePrevious.std.js';
import type { AttachmentType } from '../../../types/Attachment.std.js';

enum TabViews {
  Media = 'Media',
  Documents = 'Documents',
}

export type Props = {
  conversationId: string;
  documents: ReadonlyArray<MediaItemType>;
  i18n: LocalizerType;
  haveOldestMedia: boolean;
  haveOldestDocument: boolean;
  loading: boolean;
  initialLoad: (id: string) => unknown;
  loadMoreMedia: (id: string) => unknown;
  loadMoreDocuments: (id: string) => unknown;
  media: ReadonlyArray<MediaItemType>;
  saveAttachment: SaveAttachmentActionCreatorType;
  kickOffAttachmentDownload: (options: { messageId: string }) => void;
  cancelAttachmentDownload: (options: { messageId: string }) => void;
  showLightbox: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  theme?: ThemeType;
};

const MONTH_FORMAT = 'MMMM YYYY';

function MediaSection({
  documents,
  i18n,
  loading,
  media,
  saveAttachment,
  kickOffAttachmentDownload,
  cancelAttachmentDownload,
  showLightbox,
  type,
  theme,
}: Pick<
  Props,
  | 'documents'
  | 'i18n'
  | 'theme'
  | 'loading'
  | 'media'
  | 'saveAttachment'
  | 'kickOffAttachmentDownload'
  | 'cancelAttachmentDownload'
  | 'showLightbox'
> & { type: 'media' | 'documents' }): JSX.Element {
  const mediaItems = type === 'media' ? media : documents;

  if (!mediaItems || mediaItems.length === 0) {
    if (loading) {
      return <div />;
    }

    const label = (() => {
      switch (type) {
        case 'media':
          return i18n('icu:mediaEmptyState');

        case 'documents':
          return i18n('icu:documentsEmptyState');

        default:
          throw missingCaseError(type);
      }
    })();

    return <EmptyState data-test="EmptyState" label={label} />;
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
        i18n={i18n}
        theme={theme}
        type={type}
        mediaItems={section.mediaItems}
        onItemClick={(event: ItemClickEvent) => {
          switch (event.type) {
            case 'documents': {
              if (event.state === 'ReadyToShow') {
                saveAttachment(event.attachment, event.message.sentAt);
              } else if (event.state === 'Downloading') {
                cancelAttachmentDownload({ messageId: event.message.id });
              } else if (event.state === 'NeedsDownload') {
                kickOffAttachmentDownload({ messageId: event.message.id });
              } else {
                throw missingCaseError(event.state);
              }
              break;
            }

            case 'media': {
              if (event.state === 'ReadyToShow') {
                showLightbox({
                  attachment: event.attachment,
                  messageId: event.message.id,
                });
              } else if (event.state === 'Downloading') {
                cancelAttachmentDownload({ messageId: event.message.id });
              } else if (event.state === 'NeedsDownload') {
                kickOffAttachmentDownload({ messageId: event.message.id });
              } else {
                throw missingCaseError(event.state);
              }
              break;
            }

            default:
              throw new TypeError(`Unknown attachment type: '${event.type}'`);
          }
        }}
      />
    );
  });

  return <div className="module-media-gallery__sections">{sections}</div>;
}

export function MediaGallery({
  conversationId,
  documents,
  haveOldestDocument,
  haveOldestMedia,
  i18n,
  initialLoad,
  loading,
  loadMoreDocuments,
  loadMoreMedia,
  media,
  saveAttachment,
  kickOffAttachmentDownload,
  cancelAttachmentDownload,
  showLightbox,
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
      documents.length > 0 ||
      haveOldestDocument ||
      haveOldestMedia
    ) {
      return;
    }
    initialLoad(conversationId);
    loadingRef.current = true;
  }, [
    conversationId,
    haveOldestDocument,
    haveOldestMedia,
    initialLoad,
    media,
    documents,
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
              loadMoreMedia(conversationId);
              loadingRef.current = true;
            }
          } else {
            // eslint-disable-next-line no-lonely-if
            if (!haveOldestDocument) {
              loadMoreDocuments(conversationId);
              loadingRef.current = true;
            }
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
    loading,
    loadMoreDocuments,
    loadMoreMedia,
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
            id: TabViews.Documents,
            label: i18n('icu:documents'),
          },
        ]}
      >
        {({ selectedTab }) => {
          tabViewRef.current =
            selectedTab === TabViews.Media
              ? TabViews.Media
              : TabViews.Documents;

          return (
            <div className="module-media-gallery__content">
              {selectedTab === TabViews.Media && (
                <MediaSection
                  documents={documents}
                  i18n={i18n}
                  loading={loading}
                  media={media}
                  saveAttachment={saveAttachment}
                  showLightbox={showLightbox}
                  kickOffAttachmentDownload={kickOffAttachmentDownload}
                  cancelAttachmentDownload={cancelAttachmentDownload}
                  type="media"
                />
              )}
              {selectedTab === TabViews.Documents && (
                <MediaSection
                  documents={documents}
                  i18n={i18n}
                  loading={loading}
                  media={media}
                  saveAttachment={saveAttachment}
                  showLightbox={showLightbox}
                  kickOffAttachmentDownload={kickOffAttachmentDownload}
                  cancelAttachmentDownload={cancelAttachmentDownload}
                  type="documents"
                />
              )}
            </div>
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
