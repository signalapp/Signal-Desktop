// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { CompositionRecordingDraft } from '../../components/CompositionRecordingDraft';
import type { AttachmentDraftType } from '../../types/Attachment';
import {
  AudioPlayerContent,
  useAudioPlayerActions,
} from '../ducks/audioPlayer';
import { useComposerActions } from '../ducks/composer';
import { selectAudioPlayerActive } from '../selectors/audioPlayer';
import {
  getConversationByIdSelector,
  getSelectedConversationId,
} from '../selectors/conversations';
import { getIntl } from '../selectors/user';

export type SmartCompositionRecordingDraftProps = {
  voiceNoteAttachment: AttachmentDraftType;
};

export const SmartCompositionRecordingDraft = memo(
  function SmartCompositionRecordingDraft({
    voiceNoteAttachment,
  }: SmartCompositionRecordingDraftProps) {
    const i18n = useSelector(getIntl);
    const active = useSelector(selectAudioPlayerActive);
    const selectedConversationId = useSelector(getSelectedConversationId);
    const getConversationById = useSelector(getConversationByIdSelector);
    const {
      loadVoiceNoteDraftAudio,
      unloadMessageAudio,
      setIsPlaying,
      setPosition,
    } = useAudioPlayerActions();
    const { sendMultiMediaMessage, removeAttachment } = useComposerActions();

    if (!selectedConversationId) {
      throw new Error('No selected conversation');
    }

    const playbackRate =
      getConversationById(selectedConversationId)?.voiceNotePlaybackRate ?? 1;

    const audioUrl = !voiceNoteAttachment.pending
      ? voiceNoteAttachment.url
      : undefined;

    const content = active?.content;

    const draftActive =
      content && AudioPlayerContent.isDraft(content) && content.url === audioUrl
        ? active
        : undefined;

    const handlePlay = useCallback(
      (positionAsRatio?: number) => {
        if (!draftActive && audioUrl) {
          loadVoiceNoteDraftAudio({
            conversationId: selectedConversationId,
            url: audioUrl,
            startPosition: positionAsRatio ?? 0,
            playbackRate,
          });
        }
        if (draftActive) {
          if (positionAsRatio !== undefined) {
            setPosition(positionAsRatio);
          }
          if (!draftActive.playing) {
            setIsPlaying(true);
          }
        }
      },
      [
        draftActive,
        audioUrl,
        loadVoiceNoteDraftAudio,
        selectedConversationId,
        playbackRate,
        setPosition,
        setIsPlaying,
      ]
    );

    const handlePause = useCallback(() => {
      setIsPlaying(false);
    }, [setIsPlaying]);

    const handleSend = useCallback(() => {
      if (selectedConversationId) {
        sendMultiMediaMessage(selectedConversationId, {
          draftAttachments: [voiceNoteAttachment],
        });
      }
    }, [selectedConversationId, sendMultiMediaMessage, voiceNoteAttachment]);

    const handleCancel = useCallback(() => {
      unloadMessageAudio();
      if (selectedConversationId && voiceNoteAttachment.path) {
        removeAttachment(selectedConversationId, voiceNoteAttachment.path);
      }
    }, [
      removeAttachment,
      selectedConversationId,
      unloadMessageAudio,
      voiceNoteAttachment.path,
    ]);

    const handleScrub = useCallback(
      (positionAsRatio: number) => {
        // if scrubbing when audio not loaded
        if (!draftActive && audioUrl) {
          loadVoiceNoteDraftAudio({
            conversationId: selectedConversationId,
            url: audioUrl,
            startPosition: positionAsRatio,
            playbackRate,
          });
          return;
        }

        // if scrubbing when audio is loaded
        if (draftActive) {
          setPosition(positionAsRatio);

          if (draftActive?.playing) {
            setIsPlaying(true);
          }
        }
      },
      [
        audioUrl,
        draftActive,
        loadVoiceNoteDraftAudio,
        playbackRate,
        selectedConversationId,
        setIsPlaying,
        setPosition,
      ]
    );

    return (
      <CompositionRecordingDraft
        i18n={i18n}
        audioUrl={audioUrl}
        active={draftActive}
        onCancel={handleCancel}
        onSend={handleSend}
        onPlay={handlePlay}
        onPause={handlePause}
        onScrub={handleScrub}
      />
    );
  }
);
