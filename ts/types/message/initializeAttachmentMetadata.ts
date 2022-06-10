// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Attachment from '../Attachment';
import * as IndexedDB from '../IndexedDB';

import type { MessageAttributesType } from '../../model-types.d';

const hasAttachment =
  (predicate: (value: Attachment.AttachmentType) => boolean) =>
  (message: MessageAttributesType): IndexedDB.IndexablePresence =>
    IndexedDB.toIndexablePresence((message.attachments || []).some(predicate));

const hasFileAttachment = hasAttachment(Attachment.isFile);
const hasVisualMediaAttachment = hasAttachment(Attachment.isVisualMedia);

export const initializeAttachmentMetadata = async (
  message: MessageAttributesType
): Promise<MessageAttributesType> => {
  if (message.type === 'verified-change') {
    return message;
  }
  if (message.type === 'profile-change') {
    return message;
  }
  if (message.messageTimer || message.isViewOnce) {
    return message;
  }

  const attachments = (message.attachments || []).filter(
    (attachment: Attachment.AttachmentType) =>
      attachment.contentType !== 'text/x-signal-plain'
  );
  const hasAttachments = IndexedDB.toIndexableBoolean(attachments.length > 0);

  const hasFileAttachments = hasFileAttachment({ ...message, attachments });
  const hasVisualMediaAttachments = hasVisualMediaAttachment({
    ...message,
    attachments,
  });

  return {
    ...message,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
  };
};
