// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { CompositionRecording } from '../../components/CompositionRecording.dom.js';
import { useAudioRecorderActions } from '../ducks/audioRecorder.preload.js';
import { useComposerActions } from '../ducks/composer.preload.js';
import { useToastActions } from '../ducks/toast.preload.js';
import { getSelectedConversationId } from '../selectors/conversations.dom.js';
import { getIntl } from '../selectors/user.std.js';

export const SmartCompositionRecording = memo(
  function SmartCompositionRecording() {
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
          sendMultiMediaMessage(selectedConversationId, {
            voiceNoteAttachment,
          });
        });
      }
    }, [selectedConversationId, completeRecording, sendMultiMediaMessage]);

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
