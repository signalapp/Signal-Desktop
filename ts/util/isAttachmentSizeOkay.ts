// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import { getMaximumAttachmentSize } from '../types/Attachment';
import { showToast } from './showToast';
import { ToastFileSize } from '../components/ToastFileSize';

export function isAttachmentSizeOkay(
  attachment: Readonly<AttachmentType>
): boolean {
  const limitKb = getMaximumAttachmentSize();
  // this needs to be cast properly
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if ((attachment.data.byteLength / 1024).toFixed(4) >= limitKb) {
    const units = ['kB', 'MB', 'GB'];
    let u = -1;
    let limit = limitKb * 1000;
    do {
      limit /= 1000;
      u += 1;
    } while (limit >= 1000 && u < units.length - 1);
    showToast(ToastFileSize, {
      limit,
      units: units[u],
    });
    return false;
  }

  return true;
}
