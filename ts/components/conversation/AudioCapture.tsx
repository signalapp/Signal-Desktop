// Copyright 2016-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useState } from 'react';
import * as moment from 'moment';
import { noop } from 'lodash';

import type { AttachmentType } from '../../types/Attachment';
import { ConfirmationDialog } from '../ConfirmationDialog';
import type { LocalizerType } from '../../types/Util';
import { ErrorDialogAudioRecorderType } from '../../state/ducks/audioRecorder';
import { ToastVoiceNoteLimit } from '../ToastVoiceNoteLimit';
import { ToastVoiceNoteMustBeOnlyAttachment } from '../ToastVoiceNoteMustBeOnlyAttachment';
import { useEscapeHandling } from '../../hooks/useEscapeHandling';
import {
  useStartRecordingShortcut,
  useKeyboardShortcuts,
} from '../../hooks/useKeyboardShortcuts';

type OnSendAudioRecordingType = (rec: AttachmentType) => unknown;

export type PropsType = {
  cancelRecording: () => unknown;
  conversationId: string;
  completeRecording: (
    conversationId: string,
    onSendAudioRecording?: OnSendAudioRecordingType
  ) => unknown;
  draftAttachments: ReadonlyArray<AttachmentType>;
  errorDialogAudioRecorderType?: ErrorDialogAudioRecorderType;
  errorRecording: (e: ErrorDialogAudioRecorderType) => unknown;
  i18n: LocalizerType;
  isRecording: boolean;
  onSendAudioRecording: OnSendAudioRecordingType;
  startRecording: () => unknown;
};

enum ToastType {
  VoiceNoteLimit,
  VoiceNoteMustBeOnlyAttachment,
}

const START_DURATION_TEXT = '0:00';

export const AudioCapture = ({
  cancelRecording,
  completeRecording,
  conversationId,
  draftAttachments,
  errorDialogAudioRecorderType,
  errorRecording,
  i18n,
  isRecording,
  onSendAudioRecording,
  startRecording,
}: PropsType): JSX.Element => {
  const [durationText, setDurationText] = useState<string>(START_DURATION_TEXT);
  const [toastType, setToastType] = useState<ToastType | undefined>();

  // Cancel recording if we switch away from this conversation, unmounting
  useEffect(() => {
    if (!isRecording) {
      return;
    }

    return () => {
      cancelRecording();
    };
  }, [cancelRecording, isRecording]);

  // Stop recording and show confirmation if user switches away from this app
  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const handler = () => {
      errorRecording(ErrorDialogAudioRecorderType.Blur);
    };
    window.addEventListener('blur', handler);

    return () => {
      window.removeEventListener('blur', handler);
    };
  }, [isRecording, completeRecording, errorRecording]);

  const escapeRecording = useCallback(() => {
    if (!isRecording) {
      return;
    }

    cancelRecording();
  }, [cancelRecording, isRecording]);

  useEscapeHandling(escapeRecording);

  const startRecordingShortcut = useStartRecordingShortcut(startRecording);
  useKeyboardShortcuts(startRecordingShortcut);

  // Update timestamp regularly, then timeout if recording goes over five minutes
  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const duration = moment.duration(Date.now() - startTime, 'ms');
      const minutes = `${Math.trunc(duration.asMinutes())}`;
      let seconds = `${duration.seconds()}`;
      if (seconds.length < 2) {
        seconds = `0${seconds}`;
      }
      setDurationText(`${minutes}:${seconds}`);

      if (duration >= moment.duration(5, 'minutes')) {
        errorRecording(ErrorDialogAudioRecorderType.Timeout);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [completeRecording, errorRecording, isRecording, setDurationText]);

  const clickCancel = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  const clickSend = useCallback(() => {
    completeRecording(conversationId, onSendAudioRecording);
  }, [conversationId, completeRecording, onSendAudioRecording]);

  const closeToast = useCallback(() => {
    setToastType(undefined);
  }, []);

  let toastElement: JSX.Element | undefined;
  if (toastType === ToastType.VoiceNoteLimit) {
    toastElement = <ToastVoiceNoteLimit i18n={i18n} onClose={closeToast} />;
  } else if (toastType === ToastType.VoiceNoteMustBeOnlyAttachment) {
    toastElement = (
      <ToastVoiceNoteMustBeOnlyAttachment i18n={i18n} onClose={closeToast} />
    );
  }

  let confirmationDialog: JSX.Element | undefined;
  if (
    errorDialogAudioRecorderType === ErrorDialogAudioRecorderType.Blur ||
    errorDialogAudioRecorderType === ErrorDialogAudioRecorderType.Timeout
  ) {
    const confirmationDialogText =
      errorDialogAudioRecorderType === ErrorDialogAudioRecorderType.Blur
        ? i18n('voiceRecordingInterruptedBlur')
        : i18n('voiceRecordingInterruptedMax');

    confirmationDialog = (
      <ConfirmationDialog
        i18n={i18n}
        onCancel={clickCancel}
        onClose={noop}
        cancelText={i18n('discard')}
        actions={[
          {
            text: i18n('sendAnyway'),
            style: 'affirmative',
            action: clickSend,
          },
        ]}
      >
        {confirmationDialogText}
      </ConfirmationDialog>
    );
  } else if (
    errorDialogAudioRecorderType === ErrorDialogAudioRecorderType.ErrorRecording
  ) {
    confirmationDialog = (
      <ConfirmationDialog
        i18n={i18n}
        onCancel={clickCancel}
        onClose={noop}
        cancelText={i18n('ok')}
        actions={[]}
      >
        {i18n('voiceNoteError')}
      </ConfirmationDialog>
    );
  }

  if (isRecording && !confirmationDialog) {
    return (
      <>
        <div className="AudioCapture">
          <button
            className="AudioCapture__recorder-button AudioCapture__recorder-button--complete"
            onClick={clickSend}
            tabIndex={0}
            title={i18n('voiceRecording--complete')}
            type="button"
          >
            <span className="icon" />
          </button>
          <span className="AudioCapture__time">{durationText}</span>
          <button
            className="AudioCapture__recorder-button AudioCapture__recorder-button--cancel"
            onClick={clickCancel}
            tabIndex={0}
            title={i18n('voiceRecording--cancel')}
            type="button"
          >
            <span className="icon" />
          </button>
        </div>
        {toastElement}
      </>
    );
  }

  return (
    <>
      <div className="AudioCapture">
        <button
          aria-label={i18n('voiceRecording--start')}
          className="AudioCapture__microphone"
          onClick={() => {
            if (draftAttachments.length) {
              setToastType(ToastType.VoiceNoteMustBeOnlyAttachment);
            } else {
              setDurationText(START_DURATION_TEXT);
              setToastType(ToastType.VoiceNoteLimit);
              startRecording();
            }
          }}
          title={i18n('voiceRecording--start')}
          type="button"
        />
        {confirmationDialog}
      </div>
      {toastElement}
    </>
  );
};
