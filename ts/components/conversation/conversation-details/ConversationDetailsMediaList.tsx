// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../../types/Util';
import type { ConversationType } from '../../../state/ducks/conversations';
import type { AttachmentType } from '../../../types/Attachment';

import { PanelSection } from './PanelSection';
import { bemGenerator } from './util';
import { MediaGridItem } from '../media-gallery/MediaGridItem';

export type Props = {
  conversation: ConversationType;
  i18n: LocalizerType;
  loadRecentMediaItems: (id: string, limit: number) => void;
  showAllMedia: () => void;
  showLightbox: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
};

const MEDIA_ITEM_LIMIT = 6;

const bem = bemGenerator('ConversationDetails-media-list');

export function ConversationDetailsMediaList({
  conversation,
  i18n,
  loadRecentMediaItems,
  showAllMedia,
  showLightbox,
}: Props): JSX.Element | null {
  const mediaItems = conversation.recentMediaItems || [];

  const mediaItemsLength = mediaItems.length;

  React.useEffect(() => {
    loadRecentMediaItems(conversation.id, MEDIA_ITEM_LIMIT);
  }, [conversation.id, loadRecentMediaItems, mediaItemsLength]);

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
          {i18n('icu:ConversationDetailsMediaList--show-all')}
        </button>
      }
      title={i18n('icu:ConversationDetailsMediaList--shared-media')}
    >
      <div className={bem('root')}>
        {mediaItems.slice(0, MEDIA_ITEM_LIMIT).map(mediaItem => (
          <MediaGridItem
            key={`${mediaItem.message.id}-${mediaItem.index}`}
            mediaItem={mediaItem}
            i18n={i18n}
            onClick={() =>
              showLightbox({
                attachment: mediaItem.attachment,
                messageId: mediaItem.message.id,
              })
            }
          />
        ))}
      </div>
    </PanelSection>
  );
}
