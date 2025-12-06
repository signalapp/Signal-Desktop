// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  Fragment,
  useEffect,
  useRef,
  useCallback,
  useState,
} from 'react';

import moment from 'moment';

import type { ItemClickEvent } from './types/ItemClickEvent.std.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import type {
  MediaTabType,
  LinkPreviewMediaItemType,
  MediaItemType,
  GenericMediaItemType,
} from '../../../types/MediaItem.std.js';
import type { SaveAttachmentActionCreatorType } from '../../../state/ducks/conversations.preload.js';
import { AttachmentSection } from './AttachmentSection.dom.js';
import { EmptyState } from './EmptyState.dom.js';
import { groupMediaItemsByDate } from './groupMediaItemsByDate.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import { openLinkInWebBrowser } from '../../../util/openLinkInWebBrowser.dom.js';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver.std.js';
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
  loadMore: (id: string, type: MediaTabType) => unknown;
  media: ReadonlyArray<MediaItemType>;
  audio: ReadonlyArray<MediaItemType>;
  links: ReadonlyArray<LinkPreviewMediaItemType>;
  documents: ReadonlyArray<MediaItemType>;
  tab: MediaTabType;
  saveAttachment: SaveAttachmentActionCreatorType;
  kickOffAttachmentDownload: (options: { messageId: string }) => void;
  cancelAttachmentDownload: (options: { messageId: string }) => void;
  playAudio: (attachment: MediaItemType) => void;
  showLightbox: (options: {
    attachment: AttachmentForUIType;
    messageId: string;
  }) => void;

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
  tab: MediaTabType;
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
  const groupedItems = groupMediaItemsByDate(now, mediaItems);

  const isGrid = mediaItems.at(0)?.type === 'media';

  const sections = groupedItems.map((section, index) => {
    const isLast = index === groupedItems.length - 1;
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
      <Fragment key={header}>
        <AttachmentSection
          header={header}
          mediaItems={section.mediaItems}
          onItemClick={onItemClick}
          renderMediaItem={renderMediaItem}
        />
        {!isGrid && !isLast && (
          <hr
            className={tw('mx-4 my-3 border-[0.5px] border-border-primary')}
          />
        )}
      </Fragment>
    );
  });

  return (
    <div className={tw('grow', 'mx-auto', 'max-w-[660px] min-w-[360px]')}>
      <div className={tw('flex flex-col')}>{sections}</div>
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
  loading: reduxLoading,
  loadMore,
  media,
  audio,
  links,
  documents,
  tab,
  saveAttachment,
  kickOffAttachmentDownload,
  cancelAttachmentDownload,
  playAudio,
  showLightbox,
  renderMediaItem,
}: Props): JSX.Element {
  const focusRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(reduxLoading);

  // Reset local state when redux finishes loading
  useEffect(() => {
    if (reduxLoading === false) {
      setLoading(false);
    }
  }, [reduxLoading]);

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

  const [setObserverRef, observerEntry] = useIntersectionObserver();
  useEffect(() => {
    if (loading) {
      return;
    }

    if (!observerEntry?.isIntersecting) {
      return;
    }

    if (tab === 'media') {
      if (haveOldestMedia) {
        return;
      }
      loadMore(conversationId, 'media');
    } else if (tab === 'audio') {
      if (haveOldestAudio) {
        return;
      }
      loadMore(conversationId, 'audio');
    } else if (tab === 'documents') {
      if (haveOldestDocument) {
        return;
      }
      loadMore(conversationId, 'documents');
    } else if (tab === 'links') {
      if (haveOldestLink) {
        return;
      }
      loadMore(conversationId, 'links');
    } else {
      throw missingCaseError(tab);
    }
    setLoading(true);
  }, [
    observerEntry,
    conversationId,
    haveOldestDocument,
    haveOldestMedia,
    haveOldestAudio,
    haveOldestLink,
    loading,
    loadMore,
    tab,
  ]);

  let mediaItems: ReadonlyArray<GenericMediaItemType>;

  if (tab === 'media') {
    mediaItems = media;
  } else if (tab === 'audio') {
    mediaItems = audio;
  } else if (tab === 'documents') {
    mediaItems = documents;
  } else if (tab === 'links') {
    mediaItems = links;
  } else {
    throw new Error(`Unexpected select tab: ${tab}`);
  }

  return (
    <div
      className={tw('flex size-full grow flex-col outline-none')}
      tabIndex={-1}
      ref={focusRef}
    >
      <div className={tw('grow overflow-y-auto')}>
        <MediaSection
          i18n={i18n}
          loading={loading}
          tab={tab}
          mediaItems={mediaItems}
          saveAttachment={saveAttachment}
          showLightbox={showLightbox}
          kickOffAttachmentDownload={kickOffAttachmentDownload}
          cancelAttachmentDownload={cancelAttachmentDownload}
          playAudio={playAudio}
          renderMediaItem={renderMediaItem}
        />
        <div ref={setObserverRef} className={tw('h-px')} />
      </div>
    </div>
  );
}
