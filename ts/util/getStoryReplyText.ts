// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import type { LocalizerType } from '../types/Util';
import { isGIF, isImage, isVideo } from '../types/Attachment';

export function getStoryReplyText(
  i18n: LocalizerType,
  attachment?: AttachmentType
): string {
  if (!attachment) {
    return i18n('Quote__story-unavailable');
  }

  if (attachment.caption) {
    return attachment.caption;
  }

  const attachments = [attachment];

  if (isImage(attachments)) {
    return i18n('message--getNotificationText--photo');
  }

  if (isGIF(attachments)) {
    return i18n('message--getNotificationText--gif');
  }

  if (isVideo(attachments)) {
    return i18n('message--getNotificationText--video');
  }

  if (attachment.textAttachment && attachment.textAttachment.text) {
    return attachment.textAttachment.text;
  }

  return i18n('message--getNotificationText--file');
}
