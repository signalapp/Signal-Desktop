import { partition } from 'lodash';

import * as Attachment from '../Attachment';
import { Message } from '../message';


export const initializeAttachmentMetadata =
  async (message: Message): Promise<Message> => {
    const numAttachments = message.attachments.length;
    const [numVisualMediaAttachments, numFileAttachments] =
      partition(message.attachments, Attachment.isVisualMedia)
        .map((attachments) => attachments.length);

    return {
      ...message,
      numAttachments,
      numVisualMediaAttachments,
      numFileAttachments,
    };
  };
