// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ToastType } from '../types/Toast.dom.js';
import { SECOND } from './durations/index.std.js';
import { isOlderThan } from './timestamp.std.js';

const DOWNLOAD_FAILED_TIMESTAMP_REST = 10 * SECOND;

export const lastErrorsByMessageId = new Map<string, number>();

export function showDownloadFailedToast(messageId: string): void {
  const now = Date.now();

  for (const [id, timestamp] of lastErrorsByMessageId) {
    if (isOlderThan(timestamp, DOWNLOAD_FAILED_TIMESTAMP_REST)) {
      lastErrorsByMessageId.delete(id);
    }
  }

  const existing = lastErrorsByMessageId.get(messageId);
  if (!existing) {
    window.reduxActions.toast.showToast({
      toastType: ToastType.AttachmentDownloadFailed,
      parameters: { messageId },
    });
    lastErrorsByMessageId.set(messageId, now);
  }
}
