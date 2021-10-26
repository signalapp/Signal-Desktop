// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../../types/Util';

import type { MediaItemType } from '../../../types/MediaItem';
import type { ConversationType } from '../../../state/ducks/conversations';

import { PanelSection } from './PanelSection';
import { bemGenerator } from './util';
import { MediaGridItem } from '../media-gallery/MediaGridItem';

export type Props = {
  conversation: ConversationType;
  i18n: LocalizerType;
  loadRecentMediaItems: (limit: number) => void;
  showAllMedia: () => void;
  showLightboxForMedia: (
    selectedMediaItem: MediaItemType,
    media: Array<MediaItemType>
  ) => void;
};

const MEDIA_ITEM_LIMIT = 6;

const bem = bemGenerator('ConversationDetails-media-list');

export const ConversationDetailsMediaList: React.ComponentType<Props> = ({
  conversation,
  i18n,
  loadRecentMediaItems,
  showAllMedia,
  showLightboxForMedia,
}) => {
  const mediaItems = conversation.recentMediaItems || [];

  const mediaItemsLength = mediaItems.length;

  React.useEffect(() => {
    loadRecentMediaItems(MEDIA_ITEM_LIMIT);
  }, [loadRecentMediaItems, mediaItemsLength]);

  if (mediaItemsLength === 0) {
    return null;
  }

  return (
    <PanelSection
      actions={
        <button
          className={bem('show-all')}
          onClick={showAllMedia}
          type="button"
        >
          {i18n('ConversationDetailsMediaList--show-all')}
        </button>
      }
      title={i18n('ConversationDetailsMediaList--shared-media')}
    >
      <div className={bem('root')}>
        {mediaItems.slice(0, MEDIA_ITEM_LIMIT).map(mediaItem => (
          <MediaGridItem
            key={`${mediaItem.message.id}-${mediaItem.index}`}
            mediaItem={mediaItem}
            i18n={i18n}
            onClick={() => showLightboxForMedia(mediaItem, mediaItems)}
          />
        ))}
      </div>
    </PanelSection>
  );
};
