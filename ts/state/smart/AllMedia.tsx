// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import { MediaGallery } from '../../components/conversation/media-gallery/MediaGallery';
import { getMediaGalleryState } from '../selectors/mediaGallery';
import { useConversationsActions } from '../ducks/conversations';
import { useLightboxActions } from '../ducks/lightbox';
import { useMediaGalleryActions } from '../ducks/mediaGallery';

export type PropsType = {
  conversationId: string;
};

export function SmartAllMedia({ conversationId }: PropsType): JSX.Element {
  const { media, documents } = useSelector(getMediaGalleryState);
  const { loadMediaItems } = useMediaGalleryActions();
  const { saveAttachment } = useConversationsActions();
  const { showLightboxWithMedia } = useLightboxActions();

  return (
    <MediaGallery
      conversationId={conversationId}
      i18n={window.i18n}
      loadMediaItems={loadMediaItems}
      media={media}
      documents={documents}
      showLightboxWithMedia={showLightboxWithMedia}
      saveAttachment={saveAttachment}
    />
  );
}
