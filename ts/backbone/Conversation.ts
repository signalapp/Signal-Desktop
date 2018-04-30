/**
 * @prettier
 */
import is from '@sindresorhus/is';

import { Collection as BackboneCollection } from '../types/backbone/Collection';
import { deferredToPromise } from '../../js/modules/deferred_to_promise';
import { IndexableBoolean } from '../types/IndexedDB';
import { Message } from '../types/Message';

export const fetchVisualMediaAttachments = async ({
  conversationId,
  count,
  WhisperMessageCollection,
}: {
  conversationId: string;
  count: number;
  WhisperMessageCollection: BackboneCollection<Message>;
}): Promise<Array<Message>> =>
  fetchFromAttachmentsIndex({
    name: 'hasVisualMediaAttachments',
    conversationId,
    WhisperMessageCollection,
    count,
  });

export const fetchFileAttachments = async ({
  conversationId,
  count,
  WhisperMessageCollection,
}: {
  conversationId: string;
  count: number;
  WhisperMessageCollection: BackboneCollection<Message>;
}): Promise<Array<Message>> =>
  fetchFromAttachmentsIndex({
    name: 'hasFileAttachments',
    conversationId,
    WhisperMessageCollection,
    count,
  });

const fetchFromAttachmentsIndex = async ({
  name,
  conversationId,
  WhisperMessageCollection,
  count,
}: {
  name: 'hasVisualMediaAttachments' | 'hasFileAttachments';
  conversationId: string;
  WhisperMessageCollection: BackboneCollection<Message>;
  count: number;
}): Promise<Array<Message>> => {
  if (!is.string(conversationId)) {
    throw new TypeError("'conversationId' is required");
  }

  if (!is.object(WhisperMessageCollection)) {
    throw new TypeError("'WhisperMessageCollection' is required");
  }

  const collection = new WhisperMessageCollection();
  const lowerReceivedAt = 0;
  const upperReceivedAt = Number.MAX_VALUE;
  const condition: IndexableBoolean = 1;
  await deferredToPromise(
    collection.fetch({
      index: {
        name,
        lower: [conversationId, lowerReceivedAt, condition],
        upper: [conversationId, upperReceivedAt, condition],
        order: 'desc',
      },
      limit: count,
    })
  );

  return collection.models.map(model => model.toJSON());
};
