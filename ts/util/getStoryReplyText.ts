// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment.js';
import type { LocalizerType } from '../types/Util.js';
import { isGIF, isImage, isVideo } from '../types/Attachment.js';

export function getStoryReplyText(
  i18n: LocalizerType,
  attachment?: AttachmentType
): string {
  if (!attachment) {
    return i18n('icu:Quote__story-unavailable');
  }

  const attachments = [attachment];

  if (isImage(attachments)) {
    return i18n('icu:message--getNotificationText--photo');
  }

  if (isGIF(attachments)) {
    return i18n('icu:message--getNotificationText--gif');
  }

  if (isVideo(attachments)) {
    return i18n('icu:message--getNotificationText--video');
  }

  if (attachment.textAttachment && attachment.textAttachment.text) {
    return attachment.textAttachment.text;
  }

  return i18n('icu:message--getNotificationText--file');
}
