// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';

import type { ToastAlreadyGroupMember } from '../components/ToastAlreadyGroupMember';
import type { ToastAlreadyRequestedToJoin } from '../components/ToastAlreadyRequestedToJoin';
import type {
  ToastCannotOpenGiftBadge,
  ToastPropsType as ToastCannotOpenGiftBadgePropsType,
} from '../components/ToastCannotOpenGiftBadge';
import type { ToastCaptchaFailed } from '../components/ToastCaptchaFailed';
import type { ToastCaptchaSolved } from '../components/ToastCaptchaSolved';
import type {
  ToastConversationArchived,
  ToastPropsType as ToastConversationArchivedPropsType,
} from '../components/ToastConversationArchived';
import type { ToastConversationMarkedUnread } from '../components/ToastConversationMarkedUnread';
import type { ToastConversationUnarchived } from '../components/ToastConversationUnarchived';
import type {
  ToastInternalError,
  ToastPropsType as ToastInternalErrorPropsType,
} from '../components/ToastInternalError';
import type {
  ToastFileSize,
  ToastPropsType as ToastFileSizePropsType,
} from '../components/ToastFileSize';
import type { ToastGroupLinkCopied } from '../components/ToastGroupLinkCopied';
import type { ToastLinkCopied } from '../components/ToastLinkCopied';
import type { ToastLoadingFullLogs } from '../components/ToastLoadingFullLogs';
import type { ToastMessageBodyTooLong } from '../components/ToastMessageBodyTooLong';

import type { ToastOriginalMessageNotFound } from '../components/ToastOriginalMessageNotFound';
import type { ToastReactionFailed } from '../components/ToastReactionFailed';
import type { ToastStickerPackInstallFailed } from '../components/ToastStickerPackInstallFailed';
import type { ToastTapToViewExpiredIncoming } from '../components/ToastTapToViewExpiredIncoming';
import type { ToastTapToViewExpiredOutgoing } from '../components/ToastTapToViewExpiredOutgoing';
import type { ToastVoiceNoteLimit } from '../components/ToastVoiceNoteLimit';
import type { ToastVoiceNoteMustBeOnlyAttachment } from '../components/ToastVoiceNoteMustBeOnlyAttachment';

export function showToast(Toast: typeof ToastAlreadyGroupMember): void;
export function showToast(Toast: typeof ToastAlreadyRequestedToJoin): void;
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
export function showToast(
  Toast: typeof ToastInternalError,
  props: ToastInternalErrorPropsType
): void;
export function showToast(
  Toast: typeof ToastFileSize,
  props: ToastFileSizePropsType
): void;
export function showToast(Toast: typeof ToastGroupLinkCopied): void;
export function showToast(Toast: typeof ToastLinkCopied): void;
export function showToast(Toast: typeof ToastLoadingFullLogs): void;
export function showToast(Toast: typeof ToastMessageBodyTooLong): void;
export function showToast(Toast: typeof ToastOriginalMessageNotFound): void;
export function showToast(Toast: typeof ToastReactionFailed): void;
export function showToast(Toast: typeof ToastStickerPackInstallFailed): void;
export function showToast(Toast: typeof ToastTapToViewExpiredIncoming): void;
export function showToast(Toast: typeof ToastTapToViewExpiredOutgoing): void;
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
