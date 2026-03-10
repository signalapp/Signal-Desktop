// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, type ReactNode } from 'react';

// eslint-disable-next-line import/no-extraneous-dependencies
import { action } from '@storybook/addon-actions';

import type { PropsType } from '../../../../state/smart/MediaItem.preload.js';
import { getSafeDomain } from '../../../../types/LinkPreview.std.js';
import type { AttachmentStatusType } from '../../../../hooks/useAttachmentStatus.std.js';
import { missingCaseError } from '../../../../util/missingCaseError.std.js';
import { isVoiceMessagePlayed } from '../../../../util/isVoiceMessagePlayed.std.js';
import { LinkPreviewItem } from '../LinkPreviewItem.dom.js';
import { MediaContextMenu } from '../MediaContextMenu.dom.js';
import { MediaGridItem } from '../MediaGridItem.dom.js';
import { DocumentListItem } from '../DocumentListItem.dom.js';
import { ContactListItem } from '../ContactListItem.dom.js';
import { AudioListItem } from '../AudioListItem.dom.js';

const { i18n } = window.SignalContext;

function renderContextMenu(
  _mediaItem: unknown,
  children: ReactNode
): JSX.Element {
  return (
    <MediaContextMenu
      i18n={i18n}
      showMessage={action('showMessage')}
      removeAttachment={action('removeAttachment')}
      saveAttachment={action('saveAttachment')}
      forwardAttachment={action('forwardAttachment')}
      copyLink={action('copyLink')}
      messageContact={action('messageContact')}
    >
      {children}
    </MediaContextMenu>
  );
}

export function MediaItem({
  mediaItem,
  onItemClick,
}: PropsType): React.JSX.Element {
  const onClick = useCallback(
    (state: AttachmentStatusType['state']) => {
      onItemClick({ mediaItem, state });
    },
    [mediaItem, onItemClick]
  );

  const actions = {
    onClick,
    renderContextMenu,
    showMessage: action('showMessage'),
  };

  switch (mediaItem.type) {
    case 'audio':
      return (
        <AudioListItem
          i18n={i18n}
          authorTitle="Alice"
          isPlayed={isVoiceMessagePlayed(mediaItem.message, undefined)}
          mediaItem={mediaItem}
          {...actions}
        />
      );
    case 'media':
      return (
        <MediaGridItem
          mediaItem={mediaItem}
          i18n={i18n}
          showSize={false}
          {...actions}
        />
      );
    case 'document':
      return (
        <DocumentListItem
          i18n={i18n}
          authorTitle="Alice"
          mediaItem={mediaItem}
          {...actions}
        />
      );
    case 'contact':
      return (
        <ContactListItem
          i18n={i18n}
          authorTitle="Alice"
          mediaItem={mediaItem}
          {...actions}
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
          {...actions}
        />
      );
    }
    default:
      throw missingCaseError(mediaItem);
  }
}
