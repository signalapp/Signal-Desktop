// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';

import type { AttachmentDraftType } from '../../types/Attachment';
import type { LocalizerType } from '../../types/Util';
import { ToastVoiceNoteMustBeOnlyAttachment } from '../ToastVoiceNoteMustBeOnlyAttachment';
import {
  useStartRecordingShortcut,
  useKeyboardShortcuts,
} from '../../hooks/useKeyboardShortcuts';

export type PropsType = {
  conversationId: string;
  draftAttachments: ReadonlyArray<AttachmentDraftType>;
  i18n: LocalizerType;
  startRecording: (id: string) => unknown;
};

export function AudioCapture({
  conversationId,
  draftAttachments,
  i18n,
  startRecording,
}: PropsType): JSX.Element {
  const [showOnlyAttachmentToast, setShowOnlyAttachmentToast] = useState(false);

  const recordConversation = useCallback(
    () => startRecording(conversationId),
    [conversationId, startRecording]
  );
  const startRecordingShortcut = useStartRecordingShortcut(recordConversation);
  useKeyboardShortcuts(startRecordingShortcut);

  const handleCloseToast = useCallback(() => {
    setShowOnlyAttachmentToast(false);
  }, []);

  const handleClick = useCallback(() => {
    if (draftAttachments.length) {
      setShowOnlyAttachmentToast(true);
    } else {
      startRecording(conversationId);
    }
  }, [
    conversationId,
    draftAttachments,
    setShowOnlyAttachmentToast,
    startRecording,
  ]);

  return (
    <>
      <div className="AudioCapture">
        <button
          aria-label={i18n('voiceRecording--start')}
          className="AudioCapture__microphone"
          onClick={handleClick}
          title={i18n('voiceRecording--start')}
          type="button"
        />
      </div>
      {showOnlyAttachmentToast && (
        <ToastVoiceNoteMustBeOnlyAttachment
          i18n={i18n}
          onClose={handleCloseToast}
        />
      )}
    </>
  );
}
