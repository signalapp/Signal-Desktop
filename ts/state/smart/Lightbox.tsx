// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';

import type { ReadonlyDeep } from 'type-fest';
import type { GetConversationByIdType } from '../selectors/conversations';
import type { LocalizerType } from '../../types/Util';
import type { MediaItemType } from '../../types/MediaItem';
import type { StateType } from '../reducer';
import { Lightbox } from '../../components/Lightbox';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useLightboxActions } from '../ducks/lightbox';
import { useAudioPlayerActions } from '../ducks/audioPlayer';
import {
  getIsViewOnce,
  getMedia,
  getHasPrevMessage,
  getHasNextMessage,
  getPlaybackDisabled,
  getSelectedIndex,
  shouldShowLightbox,
} from '../selectors/lightbox';

export function SmartLightbox(): JSX.Element | null {
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const { saveAttachment } = useConversationsActions();
  const {
    closeLightbox,
    showLightboxForNextMessage,
    showLightboxForPrevMessage,
    setSelectedLightboxIndex,
  } = useLightboxActions();
  const { toggleForwardMessagesModal } = useGlobalModalActions();
  const { pauseVoiceNotePlayer } = useAudioPlayerActions();

  const conversationSelector = useSelector<StateType, GetConversationByIdType>(
    getConversationSelector
  );

  const isShowingLightbox = useSelector<StateType, boolean>(shouldShowLightbox);
  const isViewOnce = useSelector<StateType, boolean>(getIsViewOnce);
  const media = useSelector<
    StateType,
    ReadonlyArray<ReadonlyDeep<MediaItemType>>
  >(getMedia);
  const hasPrevMessage = useSelector<StateType, boolean>(getHasPrevMessage);
  const hasNextMessage = useSelector<StateType, boolean>(getHasNextMessage);
  const selectedIndex = useSelector<StateType, number>(getSelectedIndex);
  const playbackDisabled = useSelector<StateType, boolean>(getPlaybackDisabled);

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
}
