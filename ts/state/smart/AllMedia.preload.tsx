// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { MediaGallery } from '../../components/conversation/media-gallery/MediaGallery.dom.tsx';
import { createLogger } from '../../logging/log.std.ts';
import type { MediaItemType } from '../../types/MediaItem.std.ts';
import { getMessageById } from '../../messages/getMessageById.preload.ts';
import { getMediaGalleryState } from '../selectors/mediaGallery.std.ts';
import { extractVoiceNoteForPlayback } from '../selectors/audioPlayer.preload.ts';
import { getIntl, getUserConversationId } from '../selectors/user.std.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useLightboxActions } from '../ducks/lightbox.preload.ts';
import { useMediaGalleryActions } from '../ducks/mediaGallery.preload.ts';
import { useAudioPlayerActions } from '../ducks/audioPlayer.preload.ts';
import {
  MediaItem,
  type PropsType as MediaItemPropsType,
} from './MediaItem.preload.tsx';
import { useNavActions } from '../ducks/nav.std.ts';

const log = createLogger('AllMedia');

export type PropsType = {
  conversationId: string;
};

function renderMediaItem(props: MediaItemPropsType): React.JSX.Element {
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
    sortOrder,
  } = useSelector(getMediaGalleryState);
  const { initialLoad, loadMore } = useMediaGalleryActions();
  const {
    saveAttachment,
    kickOffAttachmentDownload,
    cancelAttachmentDownload,
  } = useConversationsActions();
  const { pushPanelForConversation } = useNavActions();
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
      sortOrder={sortOrder}
      showLightbox={showLightbox}
      playAudio={playAudio}
      kickOffAttachmentDownload={kickOffAttachmentDownload}
      cancelAttachmentDownload={cancelAttachmentDownload}
      saveAttachment={saveAttachment}
      pushPanelForConversation={pushPanelForConversation}
      renderMediaItem={renderMediaItem}
    />
  );
});
