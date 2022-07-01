// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import * as Attachment from '../types/Attachment';
import { showToast } from './showToast';
import { ToastFileSaved } from '../components/ToastFileSaved';

export async function saveAttachment(
  attachment: AttachmentType,
  timestamp = Date.now(),
  index = 0
): Promise<void> {
  const { openFileInFolder, readAttachmentData, saveAttachmentToDisk } =
    window.Signal.Migrations;

  const fullPath = await Attachment.save({
    attachment,
    index: index + 1,
    readAttachmentData,
    saveAttachmentToDisk,
    timestamp,
  });

  if (fullPath) {
    showToast(ToastFileSaved, {
      onOpenFile: () => {
        openFileInFolder(fullPath);
      },
    });
  }
}
