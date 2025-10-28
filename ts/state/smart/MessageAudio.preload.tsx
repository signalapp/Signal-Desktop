// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { MessageAudio } from '../../components/conversation/MessageAudio.dom.js';
import type { OwnProps as MessageAudioOwnProps } from '../../components/conversation/MessageAudio.dom.js';
import type { ActiveAudioPlayerStateType } from '../ducks/audioPlayer.preload.js';
import {
  AudioPlayerContent,
  useAudioPlayerActions,
} from '../ducks/audioPlayer.preload.js';
import {
  selectAudioPlayerActive,
  selectVoiceNoteAndConsecutive,
} from '../selectors/audioPlayer.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { getUserConversationId } from '../selectors/user.std.js';
import { createLogger } from '../../logging/log.std.js';
import {
  getConversationByIdSelector,
  getSelectedConversationId,
} from '../selectors/conversations.dom.js';

const log = createLogger('MessageAudio');

export type Props = Omit<MessageAudioOwnProps, 'active' | 'onPlayMessage'> & {
  renderingContext: string;
};

export const SmartMessageAudio = memo(function SmartMessageAudio({
  renderingContext,
  ...props
}: Props) {
  const active = useSelector(selectAudioPlayerActive);
  const { loadVoiceNoteAudio, setIsPlaying, setPlaybackRate, setPosition } =
    useAudioPlayerActions();
  const { pushPanelForConversation } = useConversationsActions();

  const getVoiceNoteData = useSelector(selectVoiceNoteAndConsecutive);
  const ourConversationId = useSelector(getUserConversationId);
  const getConversationById = useSelector(getConversationByIdSelector);
  const selectedConversationId = useSelector(getSelectedConversationId);

  if (!selectedConversationId) {
    throw new Error('No selected conversation');
  }
  const playbackRate =
    getConversationById(selectedConversationId)?.voiceNotePlaybackRate ?? 1;

  const content = active?.content;

  const messageActive: ActiveAudioPlayerStateType | undefined =
    content &&
    AudioPlayerContent.isVoiceNote(content) &&
    content.current.id === props.id &&
    content.context === renderingContext
      ? active
      : undefined;

  const handlePlayMessage = useCallback(
    (id: string, position: number) => {
      const voiceNoteData = getVoiceNoteData(id);

      if (!voiceNoteData) {
        log.warn('SmartMessageAudio: voice note not found', {
          message: id,
        });
        return;
      }

      if (!ourConversationId) {
        log.warn('SmartMessageAudio: no ourConversationId');
        return;
      }

      loadVoiceNoteAudio({
        voiceNoteData,
        position,
        context: renderingContext,
        ourConversationId,
        playbackRate,
      });
    },
    [
      getVoiceNoteData,
      loadVoiceNoteAudio,
      ourConversationId,
      renderingContext,
      playbackRate,
    ]
  );

  return (
    <MessageAudio
      active={messageActive}
      onPlayMessage={handlePlayMessage}
      setPlaybackRate={setPlaybackRate}
      setIsPlaying={setIsPlaying}
      setPosition={setPosition}
      pushPanelForConversation={pushPanelForConversation}
      {...props}
    />
  );
});
