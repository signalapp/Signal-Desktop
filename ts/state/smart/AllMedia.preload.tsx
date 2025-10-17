// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { MediaGallery } from '../../components/conversation/media-gallery/MediaGallery.dom.js';
import { getMediaGalleryState } from '../selectors/mediaGallery.std.js';
import { getIntl, getTheme } from '../selectors/user.std.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useLightboxActions } from '../ducks/lightbox.preload.js';
import { useMediaGalleryActions } from '../ducks/mediaGallery.preload.js';

export type PropsType = {
  conversationId: string;
};

export const SmartAllMedia = memo(function SmartAllMedia({
  conversationId,
}: PropsType) {
  const { media, documents, haveOldestDocument, haveOldestMedia, loading } =
    useSelector(getMediaGalleryState);
  const { initialLoad, loadMoreMedia, loadMoreDocuments } =
    useMediaGalleryActions();
  const {
    saveAttachment,
    kickOffAttachmentDownload,
    cancelAttachmentDownload,
  } = useConversationsActions();
  const { showLightbox } = useLightboxActions();
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);

  return (
    <MediaGallery
      conversationId={conversationId}
      haveOldestDocument={haveOldestDocument}
      haveOldestMedia={haveOldestMedia}
      i18n={i18n}
      theme={theme}
      initialLoad={initialLoad}
      loading={loading}
      loadMoreMedia={loadMoreMedia}
      loadMoreDocuments={loadMoreDocuments}
      media={media}
      documents={documents}
      showLightbox={showLightbox}
      kickOffAttachmentDownload={kickOffAttachmentDownload}
      cancelAttachmentDownload={cancelAttachmentDownload}
      saveAttachment={saveAttachment}
    />
  );
});
