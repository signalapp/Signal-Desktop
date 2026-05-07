// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useRef, useState, type JSX } from 'react';
import { useEscapeHandling } from '../hooks/useEscapeHandling.dom.ts';
import type {
  HideToastAction,
  ShowToastAction,
} from '../state/ducks/toast.preload.ts';
import type { PeakType } from '../types/Audio.dom.tsx';
import { ErrorDialogAudioRecorderType } from '../types/AudioRecorder.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import type { AnyToast } from '../types/Toast.dom.tsx';
import { ToastType } from '../types/Toast.dom.tsx';
import { DurationInSeconds, SECOND } from '../util/durations/index.std.ts';
import { tw } from '../axo/tw.dom.tsx';
import { durationToPlaybackText } from '../util/durationToPlaybackText.std.ts';
import { RecordingComposer } from './RecordingComposer.dom.tsx';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

const MAX_BAR_HEIGHT = 20;

export type Props = Readonly<{
  i18n: LocalizerType;
  onCancel: () => void;
  onSend: () => void;
  errorRecording: (e: ErrorDialogAudioRecorderType) => unknown;
  errorDialogAudioRecorderType?: ErrorDialogAudioRecorderType;
  peaks: ReadonlyArray<PeakType>;
  saveDraftRecordingIfNeeded: () => void;
  showToast: ShowToastAction;
  hideToast: HideToastAction;
}>;

export function CompositionRecording({
  i18n,
  onCancel,
  onSend,
  errorRecording,
  errorDialogAudioRecorderType,
  peaks,
  saveDraftRecordingIfNeeded,
  showToast,
  hideToast,
}: Props): JSX.Element {
  useEscapeHandling(onCancel);

  // switched to another app
  useEffect(() => {
    window.addEventListener('blur', saveDraftRecordingIfNeeded);
    return () => {
      window.removeEventListener('blur', saveDraftRecordingIfNeeded);
    };
  }, [saveDraftRecordingIfNeeded]);

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
      <AxoConfirmDialog.Root
        open
        onOpenChange={onCancel}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:voiceRecordingInterruptedMax')}
      >
        <AxoConfirmDialog.Cancel>{i18n('icu:discard')}</AxoConfirmDialog.Cancel>
        <AxoConfirmDialog.Action variant="primary" onClick={onSend}>
          {i18n('icu:sendAnyway')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    );
  } else if (
    errorDialogAudioRecorderType === ErrorDialogAudioRecorderType.ErrorRecording
  ) {
    confirmationDialog = (
      <AxoConfirmDialog.Root
        open
        onOpenChange={onCancel}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:voiceNoteError')}
      >
        <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
      </AxoConfirmDialog.Root>
    );
  }

  return (
    <RecordingComposer i18n={i18n} onCancel={onCancel} onSend={onSend}>
      <div className="CompositionRecording__microphone" />
      <div className="CompositionRecording__timer">
        {durationToPlaybackText(duration)}
      </div>
      <div
        className={tw(
          'shrink-0 grow overflow-hidden',
          'flex flex-row-reverse items-center gap-0.5',
          'bg-elevated-background-tertiary',
          'size-9 rounded-sm'
        )}
      >
        {peaks.toReversed().map(({ value, index }) => {
          const clamped = value * MAX_BAR_HEIGHT;
          return (
            <b
              key={index}
              style={{ height: `${clamped}px` }}
              className={tw('rounded-sm bg-label-placeholder p-px')}
            />
          );
        })}
      </div>

      {confirmationDialog}
    </RecordingComposer>
  );
}
