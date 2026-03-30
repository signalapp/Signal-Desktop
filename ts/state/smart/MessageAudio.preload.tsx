// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';

import type { RenderingContextType } from '../../types/RenderingContext.d.ts';
import { MessageAudio } from '../../components/conversation/MessageAudio.dom.tsx';
import type { OwnProps as MessageAudioOwnProps } from '../../components/conversation/MessageAudio.dom.tsx';
import type { ActiveAudioPlayerStateType } from '../ducks/audioPlayer.preload.ts';
import {
  AudioPlayerContent,
  useAudioPlayerActions,
} from '../ducks/audioPlayer.preload.ts';
import {
  selectAudioPlayerActive,
  selectVoiceNoteAndConsecutive,
} from '../selectors/audioPlayer.preload.ts';
import { createLogger } from '../../logging/log.std.ts';
import { getConversationByIdSelector } from '../selectors/conversations.dom.ts';
import { getSelectedConversationId } from '../selectors/nav.std.ts';
import { useNavActions } from '../ducks/nav.std.ts';

const log = createLogger('MessageAudio');

export type Props = Omit<MessageAudioOwnProps, 'active' | 'onPlayMessage'> & {
  renderingContext: RenderingContextType;
};

export const SmartMessageAudio = memo(function SmartMessageAudio({
  renderingContext,
  ...props
}: Props) {
  const active = useSelector(selectAudioPlayerActive);
  const { loadVoiceNoteAudio, setIsPlaying, setPlaybackRate, setPosition } =
    useAudioPlayerActions();
  const { pushPanelForConversation } = useNavActions();

  const getVoiceNoteData = useSelector(selectVoiceNoteAndConsecutive);
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

      loadVoiceNoteAudio({
        voiceNoteData,
        position,
        context: renderingContext,
        playbackRate,
      });
    },
    [getVoiceNoteData, loadVoiceNoteAudio, renderingContext, playbackRate]
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
