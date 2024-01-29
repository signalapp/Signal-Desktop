// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';

import type { ShowToastAction } from '../../state/ducks/toast';
import type { AttachmentDraftType } from '../../types/Attachment';
import type { LocalizerType } from '../../types/Util';
import { ToastType } from '../../types/Toast';
import {
  useStartRecordingShortcut,
  useKeyboardShortcuts,
} from '../../hooks/useKeyboardShortcuts';

export type PropsType = {
  conversationId: string;
  draftAttachments: ReadonlyArray<AttachmentDraftType>;
  i18n: LocalizerType;
  startRecording: (id: string) => unknown;
  showToast: ShowToastAction;
};

export function AudioCapture({
  conversationId,
  draftAttachments,
  i18n,
  startRecording,
  showToast,
}: PropsType): JSX.Element {
  const recordConversation = useCallback(
    () => startRecording(conversationId),
    [conversationId, startRecording]
  );
  const startRecordingShortcut = useStartRecordingShortcut(recordConversation);
  useKeyboardShortcuts(startRecordingShortcut);

  const handleClick = useCallback(() => {
    if (draftAttachments.length) {
      showToast({ toastType: ToastType.VoiceNoteMustBeTheOnlyAttachment });
    } else {
      startRecording(conversationId);
    }
  }, [conversationId, draftAttachments, showToast, startRecording]);

  return (
    <div className="AudioCapture">
      <button
        aria-label={i18n('icu:voiceRecording--start')}
        className="AudioCapture__microphone"
        onClick={handleClick}
        title={i18n('icu:voiceRecording--start')}
        type="button"
      />
    </div>
  );
}
