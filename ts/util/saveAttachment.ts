// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import * as Attachment from '../types/Attachment';
import { ToastDangerousFileType } from '../components/ToastDangerousFileType';
import { ToastFileSaved } from '../components/ToastFileSaved';
import { isFileDangerous } from './isFileDangerous';
import { showToast } from './showToast';
import { getMessageById } from '../messages/getMessageById';

export async function saveAttachment(
  attachment: AttachmentType,
  timestamp = Date.now(),
  index = 0
): Promise<void> {
  const { fileName = '' } = attachment;

  const isDangerous = isFileDangerous(fileName);

  if (isDangerous) {
    showToast(ToastDangerousFileType);
    return;
  }

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

export async function saveAttachmentFromMessage(
  messageId: string,
  providedAttachment?: AttachmentType
): Promise<void> {
  const message = await getMessageById(messageId);
  if (!message) {
    throw new Error(`saveAttachmentFromMessage: Message ${messageId} missing!`);
  }

  const { attachments, sent_at: timestamp } = message.attributes;
  if (!attachments || attachments.length < 1) {
    return;
  }

  const attachment =
    providedAttachment && attachments.includes(providedAttachment)
      ? providedAttachment
      : attachments[0];

  return saveAttachment(attachment, timestamp);
}
