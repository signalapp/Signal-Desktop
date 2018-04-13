/**
 * @prettier
 */
import { partition } from 'lodash';

import * as Attachment from '../Attachment';
import { Message } from '../Message';

export const initializeAttachmentMetadata = async (
  message: Message
): Promise<Message> => {
  if (message.type === 'verified-change') {
    return message;
  }

  const numAttachments = message.attachments.length;
  const [numVisualMediaAttachments, numFileAttachments] = partition(
    message.attachments,
    Attachment.isVisualMedia
  ).map(attachments => attachments.length);

  return {
    ...message,
    numAttachments,
    numVisualMediaAttachments,
    numFileAttachments,
  };
};
