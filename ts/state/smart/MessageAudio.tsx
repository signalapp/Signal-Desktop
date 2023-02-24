// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';

import { MessageAudio } from '../../components/conversation/MessageAudio';
import type { OwnProps as MessageAudioOwnProps } from '../../components/conversation/MessageAudio';
import type { ActiveAudioPlayerStateType } from '../ducks/audioPlayer';
import { useAudioPlayerActions } from '../ducks/audioPlayer';
import {
  selectAudioPlayerActive,
  selectVoiceNoteAndConsecutive,
} from '../selectors/audioPlayer';
import { useConversationsActions } from '../ducks/conversations';
import { getUserConversationId } from '../selectors/user';
import * as log from '../../logging/log';

export type Props = Omit<MessageAudioOwnProps, 'active' | 'onPlayMessage'> & {
  renderingContext: string;
};

export function SmartMessageAudio({
  renderingContext,
  ...props
}: Props): JSX.Element | null {
  const active = useSelector(selectAudioPlayerActive);
  const { loadMessageAudio, setIsPlaying, setPlaybackRate, setCurrentTime } =
    useAudioPlayerActions();
  const { pushPanelForConversation } = useConversationsActions();

  const getVoiceNoteData = useSelector(selectVoiceNoteAndConsecutive);
  const ourConversationId = useSelector(getUserConversationId);

  const messageActive: ActiveAudioPlayerStateType | undefined =
    active &&
    active.content &&
    active.content.current.id === props.id &&
    active.content.context === renderingContext
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

      loadMessageAudio({
        voiceNoteData,
        position,
        context: renderingContext,
        ourConversationId,
      });
    },
    [getVoiceNoteData, loadMessageAudio, ourConversationId, renderingContext]
  );

  return (
    <MessageAudio
      active={messageActive}
      onPlayMessage={handlePlayMessage}
      setPlaybackRate={setPlaybackRate}
      setIsPlaying={setIsPlaying}
      setCurrentTime={setCurrentTime}
      pushPanelForConversation={pushPanelForConversation}
      {...props}
    />
  );
}
