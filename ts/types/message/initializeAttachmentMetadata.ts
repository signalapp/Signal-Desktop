import { MessageModel } from '../../models/message';
import * as Attachment from '../Attachment';

const hasAttachmentInMessage =
  (predicate: (value: Attachment.Attachment) => boolean) =>
  (message: MessageModel): boolean =>
    Boolean((message.get('attachments') || []).some(predicate));

export const hasFileAttachmentInMessage = hasAttachmentInMessage(Attachment.isFile);
export const hasVisualMediaAttachmentInMessage = hasAttachmentInMessage(Attachment.isVisualMedia);

export const getAttachmentMetadata = (
  message: MessageModel
): {
  hasAttachments: 1 | 0;
  hasFileAttachments: 1 | 0;
  hasVisualMediaAttachments: 1 | 0;
} => {
  const hasAttachments = (message.get('attachments') || []).length ? 1 : 0;
  const hasFileAttachments = hasFileAttachmentInMessage(message) ? 1 : 0;
  const hasVisualMediaAttachments = hasVisualMediaAttachmentInMessage(message) ? 1 : 0;

  return {
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
  };
};
