// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { MediaGallery } from '../../components/conversation/media-gallery/MediaGallery.dom.js';
import { createLogger } from '../../logging/log.std.js';
import type { MediaItemType } from '../../types/MediaItem.std.js';
import { getMessageById } from '../../messages/getMessageById.preload.js';
import { getMediaGalleryState } from '../selectors/mediaGallery.std.js';
import { extractVoiceNoteForPlayback } from '../selectors/audioPlayer.preload.js';
import { getIntl, getUserConversationId } from '../selectors/user.std.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useLightboxActions } from '../ducks/lightbox.preload.js';
import { useMediaGalleryActions } from '../ducks/mediaGallery.preload.js';
import { useAudioPlayerActions } from '../ducks/audioPlayer.preload.js';
import {
  MediaItem,
  type PropsType as MediaItemPropsType,
} from './MediaItem.preload.js';

const log = createLogger('AllMedia');

export type PropsType = {
  conversationId: string;
};

function renderMediaItem(props: MediaItemPropsType): JSX.Element {
  return <MediaItem {...props} />;
}

export const SmartAllMedia = memo(function SmartAllMedia({
  conversationId,
}: PropsType) {
  const {
    media,
    audio,
    links,
    documents,
    haveOldestMedia,
    haveOldestAudio,
    haveOldestLink,
    haveOldestDocument,
    loading,
    tab,
  } = useSelector(getMediaGalleryState);
  const { initialLoad, loadMore } = useMediaGalleryActions();
  const {
    saveAttachment,
    kickOffAttachmentDownload,
    cancelAttachmentDownload,
  } = useConversationsActions();
  const { showLightbox } = useLightboxActions();
  const { loadVoiceNoteAudio } = useAudioPlayerActions();
  const i18n = useSelector(getIntl);
  const ourConversationId = useSelector(getUserConversationId);

  const playAudio = useCallback(
    async (mediaItem: MediaItemType) => {
      const fullMessage = await getMessageById(mediaItem.message.id);
      if (fullMessage == null) {
        log.warn('message not found', {
          message: mediaItem.message.id,
        });
        return;
      }

      const voiceNote = extractVoiceNoteForPlayback(
        fullMessage.attributes,
        ourConversationId
      );

      if (!voiceNote) {
        log.warn('voice note not found', {
          message: mediaItem.message.id,
        });
        return;
      }

      loadVoiceNoteAudio({
        voiceNoteData: {
          voiceNote,
          conversationId: mediaItem.message.conversationId,
          playbackRate: 1,
        },
        position: 0,
        context: 'AllMedia',
        playbackRate: 1,
      });
    },
    [loadVoiceNoteAudio, ourConversationId]
  );

  return (
    <MediaGallery
      conversationId={conversationId}
      haveOldestMedia={haveOldestMedia}
      haveOldestAudio={haveOldestAudio}
      haveOldestLink={haveOldestLink}
      haveOldestDocument={haveOldestDocument}
      i18n={i18n}
      initialLoad={initialLoad}
      loading={loading}
      loadMore={loadMore}
      media={media}
      audio={audio}
      links={links}
      documents={documents}
      tab={tab}
      showLightbox={showLightbox}
      playAudio={playAudio}
      kickOffAttachmentDownload={kickOffAttachmentDownload}
      cancelAttachmentDownload={cancelAttachmentDownload}
      saveAttachment={saveAttachment}
      renderMediaItem={renderMediaItem}
    />
  );
});
