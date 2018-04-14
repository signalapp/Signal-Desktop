/**
 * @prettier
 */
import { partition } from 'lodash';

import * as Attachment from '../Attachment';
import * as IndexedDB from '../IndexedDB';
import { Message } from '../Message';

export const initializeAttachmentMetadata = async (
  message: Message,
): Promise<Message> => {
  if (message.type === 'verified-change') {
    return message;
  }

  const hasAttachments = IndexedDB.toIndexableBoolean(message.attachments.length > 0);
  const [hasVisualMediaAttachments, hasFileAttachments] = partition(
    message.attachments,
    Attachment.isVisualMedia,
  )
    .map((attachments) => attachments.length > 0)
    .map(IndexedDB.toIndexableBoolean);

  return {
    ...message,
    hasAttachments,
    hasVisualMediaAttachments,
    hasFileAttachments,
  };
};
