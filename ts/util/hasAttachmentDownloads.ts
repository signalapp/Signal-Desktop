// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { partition } from 'lodash';
import type { ReadonlyMessageAttributesType } from '../model-types.d';
import { isLongMessage } from '../types/MIME';

// NOTE: If you're modifying this function then you'll likely also need
// to modify ./queueAttachmentDownloads
export function hasAttachmentDownloads(
  message: ReadonlyMessageAttributesType
): boolean {
  const attachments = message.attachments || [];

  const [longMessageAttachments, normalAttachments] = partition(
    attachments,
    attachment => isLongMessage(attachment.contentType)
  );

  if (longMessageAttachments.length > 0 || message.bodyAttachment) {
    return true;
  }

  const hasNormalAttachments = hasNormalAttachmentDownloads(normalAttachments);
  if (hasNormalAttachments) {
    return true;
  }

  const hasPreviews = hasPreviewDownloads(message.preview);
  if (hasPreviews) {
    return true;
  }

  const contacts = message.contact || [];
  const hasContacts = contacts.some(item => {
    if (!item.avatar || !item.avatar.avatar) {
      return false;
    }
    if (item.avatar.avatar.path) {
      return false;
    }
    return true;
  });
  if (hasContacts) {
    return true;
  }

  const { quote } = message;
  const quoteAttachments = quote && quote.attachments ? quote.attachments : [];
  const hasQuoteAttachments = quoteAttachments.some(item => {
    if (!item.thumbnail) {
      return false;
    }
    // We've already downloaded this!
    if (item.thumbnail.path) {
      return false;
    }
    return true;
  });
  if (hasQuoteAttachments) {
    return true;
  }

  const { sticker } = message;
  if (sticker) {
    return !sticker.data || (sticker.data && !sticker.data.path);
  }

  const { editHistory } = message;
  if (editHistory) {
    const hasAttachmentsWithinEditHistory = editHistory.some(
      edit =>
        hasNormalAttachmentDownloads(edit.attachments) ||
        hasPreviewDownloads(edit.preview)
    );

    if (hasAttachmentsWithinEditHistory) {
      return true;
    }
  }

  return false;
}

function hasPreviewDownloads(
  previews: ReadonlyMessageAttributesType['preview']
): boolean {
  return (previews || []).some(item => {
    if (!item.image) {
      return false;
    }
    // We've already downloaded this!
    if (item.image.path) {
      return false;
    }
    return true;
  });
}

function hasNormalAttachmentDownloads(
  attachments: ReadonlyMessageAttributesType['attachments']
): boolean {
  return (attachments || []).some(attachment => {
    if (!attachment) {
      return false;
    }
    // We've already downloaded this!
    if (attachment.path) {
      return false;
    }
    return true;
  });
}
