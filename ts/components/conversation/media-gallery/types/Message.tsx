/**
 * @prettier
 */
import is from '@sindresorhus/is';
import { partition, sortBy } from 'lodash';

import * as MIME from '../../../../types/MIME';
import { arrayBufferToObjectURL } from '../../../../util/arrayBufferToObjectURL';
import { Attachment } from '../../../../types/Attachment';
import { MapAsync } from '../../../../types/MapAsync';

export type Message = {
  id: string;
  attachments: Array<Attachment>;
  received_at: number;
} & { objectURL?: string };

export const loadWithObjectURL = (loadMessage: MapAsync<Message>) => async (
  messages: Array<Message>
): Promise<Array<Message>> => {
  if (!is.function_(loadMessage)) {
    throw new TypeError("'loadMessage' must be a function");
  }
  if (!is.array(messages)) {
    throw new TypeError("'messages' must be an array");
  }

  // Messages with video are too expensive to load into memory, so we don’t:
  const [messagesWithVideo, messagesWithoutVideo] = partition(
    messages,
    hasVideoAttachment
  );
  const loadedMessagesWithoutVideo: Array<Message> = await Promise.all(
    messagesWithoutVideo.map(loadMessage)
  );
  const loadedMessages = sortBy(
    [...messagesWithVideo, ...loadedMessagesWithoutVideo],
    message => -message.received_at
  );

  return loadedMessages.map(withObjectURL);
};

const hasVideoAttachment = (message: Message): boolean =>
  message.attachments.some(
    attachment =>
      !is.undefined(attachment.contentType) &&
      MIME.isVideo(attachment.contentType)
  );

export const withObjectURL = (message: Message): Message => {
  if (message.attachments.length === 0) {
    throw new TypeError('`message.attachments` cannot be empty');
  }

  const attachment = message.attachments[0];
  if (is.undefined(attachment.contentType)) {
    throw new TypeError('`attachment.contentType` is required');
  }

  if (is.undefined(attachment.data) && MIME.isVideo(attachment.contentType)) {
    return {
      ...message,
      objectURL: 'images/video.svg',
    };
  }

  const objectURL = arrayBufferToObjectURL({
    data: attachment.data,
    type: attachment.contentType,
  });
  return {
    ...message,
    objectURL,
  };
};
