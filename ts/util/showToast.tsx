// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';

import type { ToastAlreadyGroupMember } from '../components/ToastAlreadyGroupMember';
import type { ToastAlreadyRequestedToJoin } from '../components/ToastAlreadyRequestedToJoin';
import type { ToastBlocked } from '../components/ToastBlocked';
import type { ToastBlockedGroup } from '../components/ToastBlockedGroup';
import type { ToastCannotMixImageAndNonImageAttachments } from '../components/ToastCannotMixImageAndNonImageAttachments';
import type {
  ToastCannotOpenGiftBadge,
  ToastPropsType as ToastCannotOpenGiftBadgePropsType,
} from '../components/ToastCannotOpenGiftBadge';
import type { ToastCannotStartGroupCall } from '../components/ToastCannotStartGroupCall';
import type { ToastCaptchaFailed } from '../components/ToastCaptchaFailed';
import type { ToastCaptchaSolved } from '../components/ToastCaptchaSolved';
import type {
  ToastConversationArchived,
  ToastPropsType as ToastConversationArchivedPropsType,
} from '../components/ToastConversationArchived';
import type { ToastConversationMarkedUnread } from '../components/ToastConversationMarkedUnread';
import type { ToastConversationUnarchived } from '../components/ToastConversationUnarchived';
import type { ToastDangerousFileType } from '../components/ToastDangerousFileType';
import type {
  ToastDecryptionError,
  ToastPropsType as ToastDecryptionErrorPropsType,
} from '../components/ToastDecryptionError';
import type { ToastDeleteForEveryoneFailed } from '../components/ToastDeleteForEveryoneFailed';
import type { ToastExpired } from '../components/ToastExpired';
import type {
  ToastFileSaved,
  ToastPropsType as ToastFileSavedPropsType,
} from '../components/ToastFileSaved';
import type {
  ToastFileSize,
  ToastPropsType as ToastFileSizePropsType,
} from '../components/ToastFileSize';
import type { ToastGroupLinkCopied } from '../components/ToastGroupLinkCopied';
import type { ToastInvalidConversation } from '../components/ToastInvalidConversation';
import type { ToastLeftGroup } from '../components/ToastLeftGroup';
import type { ToastLinkCopied } from '../components/ToastLinkCopied';
import type { ToastLoadingFullLogs } from '../components/ToastLoadingFullLogs';
import type { ToastMaxAttachments } from '../components/ToastMaxAttachments';
import type { ToastMessageBodyTooLong } from '../components/ToastMessageBodyTooLong';
import type { ToastOneNonImageAtATime } from '../components/ToastOneNonImageAtATime';
import type { ToastOriginalMessageNotFound } from '../components/ToastOriginalMessageNotFound';
import type { ToastPinnedConversationsFull } from '../components/ToastPinnedConversationsFull';
import type { ToastReactionFailed } from '../components/ToastReactionFailed';
import type { ToastReportedSpamAndBlocked } from '../components/ToastReportedSpamAndBlocked';
import type { ToastStickerPackInstallFailed } from '../components/ToastStickerPackInstallFailed';
import type { ToastTapToViewExpiredIncoming } from '../components/ToastTapToViewExpiredIncoming';
import type { ToastTapToViewExpiredOutgoing } from '../components/ToastTapToViewExpiredOutgoing';
import type { ToastUnableToLoadAttachment } from '../components/ToastUnableToLoadAttachment';
import type { ToastVoiceNoteLimit } from '../components/ToastVoiceNoteLimit';
import type { ToastVoiceNoteMustBeOnlyAttachment } from '../components/ToastVoiceNoteMustBeOnlyAttachment';

export function showToast(Toast: typeof ToastAlreadyGroupMember): void;
export function showToast(Toast: typeof ToastAlreadyRequestedToJoin): void;
export function showToast(Toast: typeof ToastBlocked): void;
export function showToast(Toast: typeof ToastBlockedGroup): void;
export function showToast(
  Toast: typeof ToastCannotMixImageAndNonImageAttachments
): void;
export function showToast(Toast: typeof ToastCannotStartGroupCall): void;
export function showToast(
  Toast: typeof ToastCannotOpenGiftBadge,
  props: Omit<ToastCannotOpenGiftBadgePropsType, 'i18n' | 'onClose'>
): void;
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
