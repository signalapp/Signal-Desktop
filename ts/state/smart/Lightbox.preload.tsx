// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Lightbox } from '../../components/Lightbox.dom.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';
import { getIntl } from '../selectors/user.std.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useLightboxActions } from '../ducks/lightbox.preload.js';
import { useAudioPlayerActions } from '../ducks/audioPlayer.preload.js';
import {
  getIsViewOnce,
  getMedia,
  getHasPrevMessage,
  getHasNextMessage,
  getPlaybackDisabled,
  getSelectedIndex,
  shouldShowLightbox,
} from '../selectors/lightbox.std.js';

export const SmartLightbox = memo(function SmartLightbox() {
  const i18n = useSelector(getIntl);
  const { saveAttachment } = useConversationsActions();
  const {
    closeLightbox,
    showLightboxForNextMessage,
    showLightboxForPrevMessage,
    setSelectedLightboxIndex,
  } = useLightboxActions();
  const { toggleForwardMessagesModal } = useGlobalModalActions();
  const { pauseVoiceNotePlayer } = useAudioPlayerActions();

  const conversationSelector = useSelector(getConversationSelector);

  const isShowingLightbox = useSelector(shouldShowLightbox);
  const isViewOnce = useSelector(getIsViewOnce);
  const media = useSelector(getMedia);
  const hasPrevMessage = useSelector(getHasPrevMessage);
  const hasNextMessage = useSelector(getHasNextMessage);
  const selectedIndex = useSelector(getSelectedIndex);
  const playbackDisabled = useSelector(getPlaybackDisabled);

  const onPrevAttachment = useCallback(() => {
    if (selectedIndex <= 0) {
      if (hasPrevMessage) {
        showLightboxForPrevMessage();
      }
      return;
    }
    setSelectedLightboxIndex(selectedIndex - 1);
  }, [
    showLightboxForPrevMessage,
    selectedIndex,
    setSelectedLightboxIndex,
    hasPrevMessage,
  ]);

  const onNextAttachment = useCallback(() => {
    if (selectedIndex >= media.length - 1) {
      if (hasNextMessage) {
        showLightboxForNextMessage();
      }
      return;
    }
    setSelectedLightboxIndex(selectedIndex + 1);
  }, [
    showLightboxForNextMessage,
    media,
    selectedIndex,
    setSelectedLightboxIndex,
    hasNextMessage,
  ]);

  if (!isShowingLightbox) {
    return null;
  }

  return (
    <Lightbox
      closeLightbox={closeLightbox}
      getConversation={conversationSelector}
      i18n={i18n}
      isViewOnce={isViewOnce}
      media={media}
      playbackDisabled={playbackDisabled}
      saveAttachment={saveAttachment}
      selectedIndex={selectedIndex || 0}
      toggleForwardMessagesModal={toggleForwardMessagesModal}
      onMediaPlaybackStart={pauseVoiceNotePlayer}
      onPrevAttachment={onPrevAttachment}
      onNextAttachment={onNextAttachment}
      onSelectAttachment={setSelectedLightboxIndex}
      hasNextMessage={hasNextMessage}
      hasPrevMessage={hasPrevMessage}
    />
  );
});
