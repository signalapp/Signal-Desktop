// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';

import { ToastAlreadyGroupMember } from '../components/ToastAlreadyGroupMember';
import { ToastAlreadyRequestedToJoin } from '../components/ToastAlreadyRequestedToJoin';
import { ToastBlocked } from '../components/ToastBlocked';
import { ToastBlockedGroup } from '../components/ToastBlockedGroup';
import { ToastCannotMixImageAndNonImageAttachments } from '../components/ToastCannotMixImageAndNonImageAttachments';
import { ToastCannotStartGroupCall } from '../components/ToastCannotStartGroupCall';
import { ToastCaptchaFailed } from '../components/ToastCaptchaFailed';
import { ToastCaptchaSolved } from '../components/ToastCaptchaSolved';
import {
  ToastConversationArchived,
  ToastPropsType as ToastConversationArchivedPropsType,
} from '../components/ToastConversationArchived';
import { ToastConversationMarkedUnread } from '../components/ToastConversationMarkedUnread';
import { ToastConversationUnarchived } from '../components/ToastConversationUnarchived';
import { ToastDangerousFileType } from '../components/ToastDangerousFileType';
import {
  ToastDecryptionError,
  ToastPropsType as ToastDecryptionErrorPropsType,
} from '../components/ToastDecryptionError';
import { ToastDeleteForEveryoneFailed } from '../components/ToastDeleteForEveryoneFailed';
import { ToastExpired } from '../components/ToastExpired';
import {
  ToastFileSaved,
  ToastPropsType as ToastFileSavedPropsType,
} from '../components/ToastFileSaved';
import {
  ToastFileSize,
  ToastPropsType as ToastFileSizePropsType,
} from '../components/ToastFileSize';
import { ToastGroupLinkCopied } from '../components/ToastGroupLinkCopied';
import { ToastInvalidConversation } from '../components/ToastInvalidConversation';
import { ToastLeftGroup } from '../components/ToastLeftGroup';
import { ToastLinkCopied } from '../components/ToastLinkCopied';
import { ToastLoadingFullLogs } from '../components/ToastLoadingFullLogs';
import { ToastMaxAttachments } from '../components/ToastMaxAttachments';
import { ToastMessageBodyTooLong } from '../components/ToastMessageBodyTooLong';
import { ToastOneNonImageAtATime } from '../components/ToastOneNonImageAtATime';
import { ToastOriginalMessageNotFound } from '../components/ToastOriginalMessageNotFound';
import { ToastPinnedConversationsFull } from '../components/ToastPinnedConversationsFull';
import { ToastReactionFailed } from '../components/ToastReactionFailed';
import { ToastReportedSpamAndBlocked } from '../components/ToastReportedSpamAndBlocked';
import { ToastStickerPackInstallFailed } from '../components/ToastStickerPackInstallFailed';
import { ToastTapToViewExpiredIncoming } from '../components/ToastTapToViewExpiredIncoming';
import { ToastTapToViewExpiredOutgoing } from '../components/ToastTapToViewExpiredOutgoing';
import { ToastUnableToLoadAttachment } from '../components/ToastUnableToLoadAttachment';
import { ToastVoiceNoteLimit } from '../components/ToastVoiceNoteLimit';
import { ToastVoiceNoteMustBeOnlyAttachment } from '../components/ToastVoiceNoteMustBeOnlyAttachment';

export function showToast(Toast: typeof ToastAlreadyGroupMember): void;
export function showToast(Toast: typeof ToastAlreadyRequestedToJoin): void;
export function showToast(Toast: typeof ToastBlocked): void;
export function showToast(Toast: typeof ToastBlockedGroup): void;
export function showToast(
  Toast: typeof ToastCannotMixImageAndNonImageAttachments
): void;
export function showToast(Toast: typeof ToastCannotStartGroupCall): void;
export function showToast(Toast: typeof ToastCaptchaFailed): void;
export function showToast(Toast: typeof ToastCaptchaSolved): void;
export function showToast(
  Toast: typeof ToastConversationArchived,
  props: ToastConversationArchivedPropsType
): void;
export function showToast(Toast: typeof ToastConversationMarkedUnread): void;
export function showToast(Toast: typeof ToastConversationUnarchived): void;
export function showToast(Toast: typeof ToastDangerousFileType): void;
export function showToast(
  Toast: typeof ToastDecryptionError,
  props: ToastDecryptionErrorPropsType
): void;
export function showToast(Toast: typeof ToastDeleteForEveryoneFailed): void;
export function showToast(Toast: typeof ToastExpired): void;
export function showToast(
  Toast: typeof ToastFileSaved,
  props: ToastFileSavedPropsType
): void;
export function showToast(
  Toast: typeof ToastFileSize,
  props: ToastFileSizePropsType
): void;
export function showToast(Toast: typeof ToastGroupLinkCopied): void;
export function showToast(Toast: typeof ToastInvalidConversation): void;
export function showToast(Toast: typeof ToastLeftGroup): void;
export function showToast(Toast: typeof ToastLinkCopied): void;
export function showToast(Toast: typeof ToastLoadingFullLogs): void;
export function showToast(Toast: typeof ToastMaxAttachments): void;
export function showToast(Toast: typeof ToastMessageBodyTooLong): void;
export function showToast(Toast: typeof ToastOneNonImageAtATime): void;
export function showToast(Toast: typeof ToastOriginalMessageNotFound): void;
export function showToast(Toast: typeof ToastPinnedConversationsFull): void;
export function showToast(Toast: typeof ToastReactionFailed): void;
export function showToast(Toast: typeof ToastReportedSpamAndBlocked): void;
export function showToast(Toast: typeof ToastStickerPackInstallFailed): void;
export function showToast(Toast: typeof ToastTapToViewExpiredIncoming): void;
export function showToast(Toast: typeof ToastTapToViewExpiredOutgoing): void;
export function showToast(Toast: typeof ToastUnableToLoadAttachment): void;
export function showToast(Toast: typeof ToastVoiceNoteLimit): void;
export function showToast(
  Toast: typeof ToastVoiceNoteMustBeOnlyAttachment
): void;

// eslint-disable-next-line max-len
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function showToast(Toast: any, props = {}): void {
  const node = document.getElementById('toast');

  function onClose() {
    if (!node) {
      return;
    }

    unmountComponentAtNode(node);
  }

  render(<Toast i18n={window.i18n} onClose={onClose} {...props} />, node);
}
