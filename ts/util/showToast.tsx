// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';

import type { ToastCaptchaFailed } from '../components/ToastCaptchaFailed';
import type { ToastCaptchaSolved } from '../components/ToastCaptchaSolved';
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

import type { ToastStickerPackInstallFailed } from '../components/ToastStickerPackInstallFailed';
import type { ToastVoiceNoteLimit } from '../components/ToastVoiceNoteLimit';
import type { ToastVoiceNoteMustBeOnlyAttachment } from '../components/ToastVoiceNoteMustBeOnlyAttachment';

export function showToast(Toast: typeof ToastCaptchaFailed): void;
export function showToast(Toast: typeof ToastCaptchaSolved): void;
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
export function showToast(Toast: typeof ToastStickerPackInstallFailed): void;
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
