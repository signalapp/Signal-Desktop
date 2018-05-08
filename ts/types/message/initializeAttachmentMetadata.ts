import * as Attachment from '../Attachment';
import * as IndexedDB from '../IndexedDB';
import { Message, UserMessage } from '../Message';

const hasAttachment = (
  predicate: (value: Attachment.Attachment) => boolean
) => (message: UserMessage): IndexedDB.IndexablePresence =>
  IndexedDB.toIndexablePresence(message.attachments.some(predicate));

const hasFileAttachment = hasAttachment(Attachment.isFile);
const hasVisualMediaAttachment = hasAttachment(Attachment.isVisualMedia);

export const initializeAttachmentMetadata = async (
  message: Message
): Promise<Message> => {
  if (message.type === 'verified-change') {
    return message;
  }

  const hasAttachments = IndexedDB.toIndexableBoolean(
    message.attachments.length > 0
  );

  const hasFileAttachments = hasFileAttachment(message);
  const hasVisualMediaAttachments = hasVisualMediaAttachment(message);

  return {
    ...message,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
  };
};
