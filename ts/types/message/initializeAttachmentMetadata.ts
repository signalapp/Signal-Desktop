import { MessageModel } from '../../models/message';
import * as Attachment from '../Attachment';

const hasAttachment = (predicate: (value: Attachment.Attachment) => boolean) => (
  message: MessageModel
): boolean => Boolean((message.get('attachments') || []).some(predicate));

const hasFileAttachment = hasAttachment(Attachment.isFile);
const hasVisualMediaAttachment = hasAttachment(Attachment.isVisualMedia);

export const getAttachmentMetadata = async (
  message: MessageModel
): Promise<{
  hasAttachments: 1 | 0;
  hasFileAttachments: 1 | 0;
  hasVisualMediaAttachments: 1 | 0;
}> => {
  const hasAttachments = Boolean(message.get('attachments').length) ? 1 : 0;
  const hasFileAttachments = hasFileAttachment(message) ? 1 : 0;
  const hasVisualMediaAttachments = hasVisualMediaAttachment(message) ? 1 : 0;

  return {
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
  };
};
