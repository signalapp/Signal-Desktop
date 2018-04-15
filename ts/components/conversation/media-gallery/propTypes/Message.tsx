/**
 * @prettier
 */
import is from '@sindresorhus/is';

import { arrayBufferToObjectURL } from '../../../../util/arrayBufferToObjectURL';
import { Attachment } from '../../../../types/Attachment';
import { MapAsync } from '../../../../types/MapAsync';
import { MIMEType } from '../../../../types/MIME';

export type Message = {
  attachments: Array<Attachment>;
  received_at: number;
} & { objectURL?: string };

const DEFAULT_CONTENT_TYPE: MIMEType = 'application/octet-stream' as MIMEType;

export const loadWithObjectURL = (loadMessage: MapAsync<Message>) => async (
  media: Array<Message>
): Promise<Array<Message>> => {
  if (!is.function_(loadMessage)) {
    throw new TypeError("'loadMessage' must be a function");
  }
  if (!is.array(media)) {
    throw new TypeError("'media' must be a function");
  }

  const mediaWithAttachmentData = await Promise.all(media.map(loadMessage));
  return mediaWithAttachmentData.map(withObjectURL);
};

const withObjectURL = (message: Message): Message => {
  if (message.attachments.length === 0) {
    throw new TypeError('`message.attachments` cannot be empty');
  }
  const attachment = message.attachments[0];
  const objectURL = arrayBufferToObjectURL({
    data: attachment.data,
    type: attachment.contentType || DEFAULT_CONTENT_TYPE,
  });
  return {
    ...message,
    objectURL,
  };
};
