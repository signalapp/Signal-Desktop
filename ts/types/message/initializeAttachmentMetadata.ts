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
  if (message.messageTimer || message.isViewOnce) {
    return message;
  }

  const attachments = message.attachments.filter(
    (attachment: Attachment.Attachment) =>
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
