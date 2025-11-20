// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback } from 'react';

// eslint-disable-next-line import/no-extraneous-dependencies
import { action } from '@storybook/addon-actions';

import type { PropsType } from '../../../../state/smart/MediaItem.preload.js';
import { getSafeDomain } from '../../../../types/LinkPreview.std.js';
import type { AttachmentStatusType } from '../../../../hooks/useAttachmentStatus.std.js';
import { missingCaseError } from '../../../../util/missingCaseError.std.js';
import { isVoiceMessagePlayed } from '../../../../util/isVoiceMessagePlayed.std.js';
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
  const onShowMessage = action('onShowMessage');

  switch (mediaItem.type) {
    case 'audio':
      return (
        <AudioListItem
          i18n={i18n}
          authorTitle="Alice"
          isPlayed={isVoiceMessagePlayed(mediaItem.message, undefined)}
          mediaItem={mediaItem}
          onClick={onClick}
          onShowMessage={onShowMessage}
        />
      );
    case 'media':
      return (
        <MediaGridItem mediaItem={mediaItem} onClick={onClick} i18n={i18n} />
      );
    case 'document':
      return (
        <DocumentListItem
          i18n={i18n}
          authorTitle="Alice"
          mediaItem={mediaItem}
          onClick={onClick}
          onShowMessage={onShowMessage}
        />
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
          onShowMessage={onShowMessage}
        />
      );
    }
    default:
      throw missingCaseError(mediaItem);
  }
}
