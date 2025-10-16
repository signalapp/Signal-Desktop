// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d.ts';
import type { AttachmentType } from '../types/Attachment.std.js';

export function getFilePathsOwnedByAttachment(attachment: AttachmentType): {
  externalAttachments: Set<string>;
  externalDownloads: Set<string>;
} {
  const externalAttachments = new Set<string>();
  const externalDownloads = new Set<string>();

  // Copied attachments weakly reference their paths and do not 'own' them
  if (attachment.copied) {
    return { externalAttachments, externalDownloads };
  }

  const { path, thumbnail, screenshot, thumbnailFromBackup, downloadPath } =
    attachment;
  if (path) {
    externalAttachments.add(path);
  }

  // downloadPath is relative to downloads folder and has to be tracked
  // separately.
  if (downloadPath) {
    externalDownloads.add(downloadPath);
  }

  if (thumbnail && thumbnail.path) {
    externalAttachments.add(thumbnail.path);
  }

  if (screenshot && screenshot.path) {
    externalAttachments.add(screenshot.path);
  }

  if (thumbnailFromBackup && thumbnailFromBackup.path) {
    externalAttachments.add(thumbnailFromBackup.path);
  }
  return { externalAttachments, externalDownloads };
}

function getFilePathsForVersionOfMessage(
  rootOrEditHistoryMessage: Partial<MessageAttributesType>
): {
  externalAttachments: Set<string>;
  externalDownloads: Set<string>;
} {
  const externalAttachments = new Set<string>();
  const externalDownloads = new Set<string>();
  function addFilePathsOwnedByAttachment(attachment: AttachmentType) {
    const result = getFilePathsOwnedByAttachment(attachment);
    result.externalAttachments.forEach(path => externalAttachments.add(path));
    result.externalDownloads.forEach(path => externalDownloads.add(path));
  }

  const { attachments, bodyAttachment, contact, quote, preview, sticker } =
    rootOrEditHistoryMessage;

  attachments?.forEach(addFilePathsOwnedByAttachment);

  if (bodyAttachment) {
    addFilePathsOwnedByAttachment(bodyAttachment);
  }

  if (quote?.attachments) {
    quote.attachments.forEach(attachment => {
      if (attachment.thumbnail) {
        addFilePathsOwnedByAttachment(attachment.thumbnail);
      }
    });
  }

  if (contact) {
    contact.forEach(item => {
      if (item.avatar?.avatar) {
        addFilePathsOwnedByAttachment(item.avatar.avatar);
      }
    });
  }

  if (preview) {
    preview.forEach(item => {
      if (item.image) {
        addFilePathsOwnedByAttachment(item.image);
      }
    });
  }

  if (sticker?.data) {
    addFilePathsOwnedByAttachment(sticker.data);
  }
  return { externalAttachments, externalDownloads };
}

export function getFilePathsOwnedByMessage(message: MessageAttributesType): {
  externalAttachments: Array<string>;
  externalDownloads: Array<string>;
} {
  const externalAttachments = new Set<string>();
  const externalDownloads = new Set<string>();

  [message, ...(message.editHistory ?? [])].forEach(version => {
    const result = getFilePathsForVersionOfMessage(version);
    result.externalAttachments.forEach(path => externalAttachments.add(path));
    result.externalDownloads.forEach(path => externalDownloads.add(path));
  });

  return {
    externalAttachments: [...externalAttachments],
    externalDownloads: [...externalDownloads],
  };
}
