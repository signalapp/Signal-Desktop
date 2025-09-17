// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { CompositionRecording } from '../../components/CompositionRecording.js';
import { useAudioRecorderActions } from '../ducks/audioRecorder.js';
import { useComposerActions } from '../ducks/composer.js';
import { useToastActions } from '../ducks/toast.js';
import { getSelectedConversationId } from '../selectors/conversations.js';
import { getIntl } from '../selectors/user.js';

export type SmartCompositionRecordingProps = {
  onBeforeSend: () => void;
};

export const SmartCompositionRecording = memo(
  function SmartCompositionRecording({
    onBeforeSend,
  }: SmartCompositionRecordingProps) {
    const i18n = useSelector(getIntl);
    const selectedConversationId = useSelector(getSelectedConversationId);
    const { errorRecording, cancelRecording, completeRecording } =
      useAudioRecorderActions();

    const { sendMultiMediaMessage, addAttachment, saveDraftRecordingIfNeeded } =
      useComposerActions();
    const { hideToast, showToast } = useToastActions();

    const handleCancel = useCallback(() => {
      cancelRecording();
    }, [cancelRecording]);

    const handleSend = useCallback(() => {
      if (selectedConversationId) {
        completeRecording(selectedConversationId, voiceNoteAttachment => {
          onBeforeSend();
          sendMultiMediaMessage(selectedConversationId, {
            voiceNoteAttachment,
          });
        });
      }
    }, [
      selectedConversationId,
      completeRecording,
      onBeforeSend,
      sendMultiMediaMessage,
    ]);

    if (!selectedConversationId) {
      return null;
    }

    return (
      <CompositionRecording
        i18n={i18n}
        onCancel={handleCancel}
        onSend={handleSend}
        errorRecording={errorRecording}
        addAttachment={addAttachment}
        completeRecording={completeRecording}
        saveDraftRecordingIfNeeded={saveDraftRecordingIfNeeded}
        showToast={showToast}
        hideToast={hideToast}
      />
    );
  }
);
