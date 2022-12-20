// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef } from 'react';

import moment from 'moment';

import type { ItemClickEvent } from './types/ItemClickEvent';
import type { LocalizerType } from '../../../types/Util';
import type { MediaItemType } from '../../../types/MediaItem';
import type { SaveAttachmentActionCreatorType } from '../../../state/ducks/conversations';
import { AttachmentSection } from './AttachmentSection';
import { EmptyState } from './EmptyState';
import { Tabs } from '../../Tabs';
import { getMessageTimestamp } from '../../../util/getMessageTimestamp';
import { groupMediaItemsByDate } from './groupMediaItemsByDate';
import { missingCaseError } from '../../../util/missingCaseError';

enum TabViews {
  Media = 'Media',
  Documents = 'Documents',
}

export type Props = {
  conversationId: string;
  documents: Array<MediaItemType>;
  i18n: LocalizerType;
  loadMediaItems: (id: string) => unknown;
  media: Array<MediaItemType>;
  saveAttachment: SaveAttachmentActionCreatorType;
  showLightboxWithMedia: (
    selectedAttachmentPath: string | undefined,
    media: Array<MediaItemType>
  ) => void;
};

const MONTH_FORMAT = 'MMMM YYYY';

function MediaSection({
  type,
  i18n,
  media,
  documents,
  saveAttachment,
  showLightboxWithMedia,
}: Pick<
  Props,
  'i18n' | 'media' | 'documents' | 'showLightboxWithMedia' | 'saveAttachment'
> & { type: 'media' | 'documents' }): JSX.Element {
  const mediaItems = type === 'media' ? media : documents;

  if (!mediaItems || mediaItems.length === 0) {
    const label = (() => {
      switch (type) {
        case 'media':
          return i18n('mediaEmptyState');

        case 'documents':
          return i18n('documentsEmptyState');

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
    const date = moment(getMessageTimestamp(message));
    const header =
      section.type === 'yearMonth'
        ? date.format(MONTH_FORMAT)
        : i18n(section.type);

    return (
      <AttachmentSection
        key={header}
        header={header}
        i18n={i18n}
        type={type}
        mediaItems={section.mediaItems}
        onItemClick={(event: ItemClickEvent) => {
          switch (event.type) {
            case 'documents': {
              saveAttachment(event.attachment, event.message.sent_at);
              break;
            }

            case 'media': {
              showLightboxWithMedia(event.attachment.path, media);
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
  i18n,
  loadMediaItems,
  media,
  saveAttachment,
  showLightboxWithMedia,
}: Props): JSX.Element {
  const focusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    focusRef.current?.focus();
  }, []);

  useEffect(() => {
    loadMediaItems(conversationId);
  }, [conversationId, loadMediaItems]);

  return (
    <div className="module-media-gallery" tabIndex={-1} ref={focusRef}>
      <Tabs
        initialSelectedTab={TabViews.Media}
        tabs={[
          {
            id: TabViews.Media,
            label: i18n('media'),
          },
          {
            id: TabViews.Documents,
            label: i18n('documents'),
          },
        ]}
      >
        {({ selectedTab }) => (
          <div className="module-media-gallery__content">
            {selectedTab === TabViews.Media && (
              <MediaSection
                documents={documents}
                i18n={i18n}
                media={media}
                saveAttachment={saveAttachment}
                showLightboxWithMedia={showLightboxWithMedia}
                type="media"
              />
            )}
            {selectedTab === TabViews.Documents && (
              <MediaSection
                documents={documents}
                i18n={i18n}
                media={media}
                saveAttachment={saveAttachment}
                showLightboxWithMedia={showLightboxWithMedia}
                type="documents"
              />
            )}
          </div>
        )}
      </Tabs>
    </div>
  );
}
