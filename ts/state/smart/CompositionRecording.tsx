// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { CompositionRecording } from '../../components/CompositionRecording';
import { mapDispatchToProps } from '../actions';
import { useAudioRecorderActions } from '../ducks/audioRecorder';
import { useComposerActions } from '../ducks/composer';
import { useToastActions } from '../ducks/toast';
import { getSelectedConversationId } from '../selectors/conversations';
import { getIntl } from '../selectors/user';

export type SmartCompositionRecordingProps = {
  onBeforeSend: () => void;
};

export function SmartCompositionRecording({
  onBeforeSend,
}: SmartCompositionRecordingProps): JSX.Element | null {
  const i18n = useSelector(getIntl);
  const selectedConversationId = useSelector(getSelectedConversationId);
  const { cancelRecording, completeRecording } = useAudioRecorderActions();

  const { sendMultiMediaMessage } = useComposerActions();
  const { hideToast, showToast } = useToastActions();

  const handleCancel = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  const handleSend = useCallback(() => {
    if (selectedConversationId) {
      completeRecording(selectedConversationId, voiceNoteAttachment => {
        onBeforeSend();
        sendMultiMediaMessage(selectedConversationId, { voiceNoteAttachment });
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
      conversationId={selectedConversationId}
      onCancel={handleCancel}
      onSend={handleSend}
      errorRecording={mapDispatchToProps.errorRecording}
      addAttachment={mapDispatchToProps.addAttachment}
      completeRecording={mapDispatchToProps.completeRecording}
      showToast={showToast}
      hideToast={hideToast}
    />
  );
}
