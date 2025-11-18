// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { LinkPreviewItem } from '../../components/conversation/media-gallery/LinkPreviewItem.dom.js';
import { MediaGridItem } from '../../components/conversation/media-gallery/MediaGridItem.dom.js';
import { DocumentListItem } from '../../components/conversation/media-gallery/DocumentListItem.dom.js';
import { AudioListItem } from '../../components/conversation/media-gallery/AudioListItem.dom.js';
import type { ItemClickEvent } from '../../components/conversation/media-gallery/types/ItemClickEvent.std.js';
import { getSafeDomain } from '../../types/LinkPreview.std.js';
import type { GenericMediaItemType } from '../../types/MediaItem.std.js';
import type { AttachmentStatusType } from '../../hooks/useAttachmentStatus.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { getIntl, getTheme } from '../selectors/user.std.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';

export type PropsType = Readonly<{
  onItemClick: (event: ItemClickEvent) => unknown;
  mediaItem: GenericMediaItemType;
}>;

export const MediaItem = memo(function MediaItem({
  mediaItem,
  onItemClick,
}: PropsType) {
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const getConversation = useSelector(getConversationSelector);

  const authorTitle =
    mediaItem.message.type === 'outgoing'
      ? i18n('icu:you')
      : getConversation(
          mediaItem.message.sourceServiceId ?? mediaItem.message.source
        ).title;

  const onClick = useCallback(
    (state: AttachmentStatusType['state']) => {
      onItemClick({ mediaItem, state });
    },
    [mediaItem, onItemClick]
  );

  switch (mediaItem.type) {
    case 'audio':
      return (
        <AudioListItem
          i18n={i18n}
          authorTitle={authorTitle}
          mediaItem={mediaItem}
          onClick={onClick}
        />
      );
    case 'media':
      return (
        <MediaGridItem
          mediaItem={mediaItem}
          onClick={onClick}
          i18n={i18n}
          theme={theme}
        />
      );
    case 'document':
      return (
        <DocumentListItem i18n={i18n} mediaItem={mediaItem} onClick={onClick} />
      );
    case 'link': {
      const hydratedMediaItem = {
        ...mediaItem,
        preview: {
          ...mediaItem.preview,
          domain: getSafeDomain(mediaItem.preview.url),
        },
      };

      return (
        <LinkPreviewItem
          i18n={i18n}
          theme={theme}
          authorTitle={authorTitle}
          mediaItem={hydratedMediaItem}
          onClick={onClick}
        />
      );
    }
    default:
      throw missingCaseError(mediaItem);
  }
});
