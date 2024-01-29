// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop } from 'lodash';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEscapeHandling } from '../hooks/useEscapeHandling';
import { usePrevious } from '../hooks/usePrevious';
import type { HideToastAction, ShowToastAction } from '../state/ducks/toast';
import type { InMemoryAttachmentDraftType } from '../types/Attachment';
import { ErrorDialogAudioRecorderType } from '../types/AudioRecorder';
import type { LocalizerType } from '../types/Util';
import type { AnyToast } from '../types/Toast';
import { ToastType } from '../types/Toast';
import { DurationInSeconds, SECOND } from '../util/durations';
import { durationToPlaybackText } from '../util/durationToPlaybackText';
import { ConfirmationDialog } from './ConfirmationDialog';
import { RecordingComposer } from './RecordingComposer';

export type Props = {
  i18n: LocalizerType;
  conversationId: string;
  onCancel: () => void;
  onSend: () => void;
  errorRecording: (e: ErrorDialogAudioRecorderType) => unknown;
  errorDialogAudioRecorderType?: ErrorDialogAudioRecorderType;
  addAttachment: (
    conversationId: string,
    attachment: InMemoryAttachmentDraftType
  ) => unknown;
  completeRecording: (
    conversationId: string,
    onRecordingComplete: (rec: InMemoryAttachmentDraftType) => unknown
  ) => unknown;
  showToast: ShowToastAction;
  hideToast: HideToastAction;
};

export function CompositionRecording({
  i18n,
  conversationId,
  onCancel,
  onSend,
  errorRecording,
  errorDialogAudioRecorderType,
  addAttachment,
  completeRecording,
  showToast,
  hideToast,
}: Props): JSX.Element {
  useEscapeHandling(onCancel);

  // when interrupted (blur, switching convos)
  // stop recording and save draft
  const handleRecordingInterruption = useCallback(() => {
    completeRecording(conversationId, attachment => {
      addAttachment(conversationId, attachment);
    });
  }, [conversationId, completeRecording, addAttachment]);

  // switched to another app
  useEffect(() => {
    window.addEventListener('blur', handleRecordingInterruption);
    return () => {
      window.removeEventListener('blur', handleRecordingInterruption);
    };
  }, [handleRecordingInterruption]);

  // switched conversations
  const previousConversationId = usePrevious(conversationId, conversationId);
  useEffect(() => {
    if (previousConversationId !== conversationId) {
      handleRecordingInterruption();
    }
  });

  useEffect(() => {
    const toast: AnyToast = { toastType: ToastType.VoiceNoteLimit };
    showToast(toast);

    return () => hideToast(toast);
  }, [showToast, hideToast]);

  const startTime = useRef(Date.now());
  const [duration, setDuration] = useState(0);
  const drift = useRef(0);

  // update recording duration
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const now = Date.now();
      const newDurationMs = now - startTime.current;
      drift.current = newDurationMs % SECOND;
      setDuration(newDurationMs / SECOND);

      if (
        DurationInSeconds.fromMillis(newDurationMs) >= DurationInSeconds.HOUR
      ) {
        errorRecording(ErrorDialogAudioRecorderType.Timeout);
      }
    }, SECOND - drift.current);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [duration, errorRecording]);

  let confirmationDialog: JSX.Element | undefined;
  if (errorDialogAudioRecorderType === ErrorDialogAudioRecorderType.Timeout) {
    confirmationDialog = (
      <ConfirmationDialog
        dialogName="AudioCapture.sendAnyway"
        i18n={i18n}
        onCancel={onCancel}
        onClose={noop}
        cancelText={i18n('icu:discard')}
        actions={[
          {
            text: i18n('icu:sendAnyway'),
            style: 'affirmative',
            action: onSend,
          },
        ]}
      >
        {i18n('icu:voiceRecordingInterruptedMax')}
      </ConfirmationDialog>
    );
  } else if (
    errorDialogAudioRecorderType === ErrorDialogAudioRecorderType.ErrorRecording
  ) {
    confirmationDialog = (
      <ConfirmationDialog
        dialogName="AudioCapture.error"
        i18n={i18n}
        onCancel={onCancel}
        onClose={noop}
        cancelText={i18n('icu:ok')}
        actions={[]}
      >
        {i18n('icu:voiceNoteError')}
      </ConfirmationDialog>
    );
  }

  return (
    <RecordingComposer i18n={i18n} onCancel={onCancel} onSend={onSend}>
      <div className="CompositionRecording__microphone" />
      <div className="CompositionRecording__timer">
        {durationToPlaybackText(duration)}
      </div>

      {confirmationDialog}
    </RecordingComposer>
  );
}
