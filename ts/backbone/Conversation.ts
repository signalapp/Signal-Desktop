/**
 * @prettier
 */
import is from '@sindresorhus/is';

import { Collection as BackboneCollection } from '../types/backbone/Collection';
import { deferredToPromise } from '../../js/modules/deferred_to_promise';
import { Message } from '../types/Message';

export const fetchVisualMediaAttachments = async ({
  conversationId,
  WhisperMessageCollection,
}: {
  conversationId: string;
  WhisperMessageCollection: BackboneCollection<Message>;
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
  const hasVisualMediaAttachments = 1;
  await deferredToPromise(
    collection.fetch({
      index: {
        name: 'hasVisualMediaAttachments',
        lower: [conversationId, hasVisualMediaAttachments, lowerReceivedAt],
        upper: [conversationId, hasVisualMediaAttachments, upperReceivedAt],
        order: 'desc',
      },
      limit: 50,
    })
  );

  return collection.models.map(model => model.toJSON());
};
