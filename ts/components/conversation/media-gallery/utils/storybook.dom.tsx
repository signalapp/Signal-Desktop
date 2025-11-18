// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback } from 'react';
import type { PropsType } from '../../../../state/smart/MediaItem.dom.js';
import { getSafeDomain } from '../../../../types/LinkPreview.std.js';
import type { AttachmentStatusType } from '../../../../hooks/useAttachmentStatus.std.js';
import { missingCaseError } from '../../../../util/missingCaseError.std.js';
import { LinkPreviewItem } from '../LinkPreviewItem.dom.js';
import { MediaGridItem } from '../MediaGridItem.dom.js';
import { DocumentListItem } from '../DocumentListItem.dom.js';
import { AudioListItem } from '../AudioListItem.dom.js';

const { i18n } = window.SignalContext;

export function MediaItem({ mediaItem, onItemClick }: PropsType): JSX.Element {
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
          authorTitle="Alice"
          mediaItem={mediaItem}
          onClick={onClick}
        />
      );
    case 'media':
      return (
        <MediaGridItem mediaItem={mediaItem} onClick={onClick} i18n={i18n} />
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
          authorTitle="Alice"
          mediaItem={hydratedMediaItem}
          onClick={onClick}
        />
      );
    }
    default:
      throw missingCaseError(mediaItem);
  }
}
