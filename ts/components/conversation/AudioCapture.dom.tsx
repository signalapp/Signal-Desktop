// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, type JSX } from 'react';

import type { ShowToastAction } from '../../state/ducks/toast.preload.ts';
import type { AttachmentDraftType } from '../../types/Attachment.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { ToastType } from '../../types/Toast.dom.tsx';
import {
  useStartRecordingShortcut,
  useKeyboardShortcuts,
} from '../../hooks/useKeyboardShortcuts.dom.tsx';
import { AxoIconButton } from '../../axo/AxoIconButton.dom.tsx';

export type PropsType = {
  conversationId: string;
  draftAttachments: ReadonlyArray<AttachmentDraftType>;
  i18n: LocalizerType;
  startRecording: (id: string) => unknown;
  warmupRecording: () => void;
  showToast: ShowToastAction;
};

export function AudioCapture({
  conversationId,
  draftAttachments,
  i18n,
  startRecording,
  warmupRecording,
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

  const handleWarmup = useCallback(() => {
    warmupRecording();
  }, [warmupRecording]);

  return (
    <div className="AudioCapture">
      <AxoIconButton.Root
        symbol="mic"
        variant="borderless-secondary"
        size="md"
        label={i18n('icu:voiceRecording--start')}
        onClick={handleClick}
        onMouseEnter={handleWarmup}
        onFocus={handleWarmup}
        tooltip={false}
      />
    </div>
  );
}
