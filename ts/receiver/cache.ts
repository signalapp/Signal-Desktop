import { map, toNumber } from 'lodash';

import { EnvelopePlus } from './types';
import { StringUtils } from '../session/utils';
import { Data } from '../data/data';
import { UnprocessedParameter } from '../types/sqlSharedTypes';

export async function removeFromCache(envelope: Pick<EnvelopePlus, 'id'>) {
  return Data.removeUnprocessed(envelope.id);
}

export async function addToCache(
  envelope: EnvelopePlus,
  plaintext: ArrayBuffer,
  messageHash: string
) {
  const { id } = envelope;

  const encodedEnvelope = StringUtils.decode(plaintext, 'base64');
  const data: UnprocessedParameter = {
    id,
    version: 2,
    envelope: encodedEnvelope,
    messageHash,
    timestamp: Date.now(),
    attempts: 1,
  };

  if (envelope.senderIdentity) {
    data.senderIdentity = envelope.senderIdentity;
  }
  await Data.saveUnprocessed(data);
}

async function fetchAllFromCache(): Promise<Array<UnprocessedParameter>> {
  const count = await Data.getUnprocessedCount();

  if (count > 1500) {
    await Data.removeAllUnprocessed();
    window?.log?.warn(`There were ${count} messages in cache. Deleted all instead of reprocessing`);
    return [];
  }

  return Data.getAllUnprocessed();
}

async function increaseAttemptsOrRemove(
  items: Array<UnprocessedParameter>
): Promise<Array<UnprocessedParameter>> {
  return Promise.all(
    map(items, async item => {
      const attempts = toNumber(item.attempts || 0) + 1;

      try {
        if (attempts >= 10) {
          window?.log?.warn('increaseAttemptsOrRemove final attempt for envelope', item.id);
          await Data.removeUnprocessed(item.id);
        } else {
          await Data.updateUnprocessedAttempts(item.id, attempts);
        }
      } catch (error) {
        window?.log?.error(
          'increaseAttemptsOrRemove error updating item after load:',
          error && error.stack ? error.stack : error
        );
      }

      return item;
    })
  );
}

export async function getAllFromCache() {
  window?.log?.info('getAllFromCache');
  const items = await fetchAllFromCache();

  window?.log?.info('getAllFromCache loaded', items.length, 'saved envelopes');
  return increaseAttemptsOrRemove(items);
}

export async function getAllFromCacheForSource(source: string) {
  const items = await fetchAllFromCache();

  // keep items without source too (for old message already added to the cache)
  const itemsFromSource = items.filter(
    item => !!item.senderIdentity || item.senderIdentity === source
  );

  window?.log?.info('getAllFromCacheForSource loaded', itemsFromSource.length, 'saved envelopes');

  return increaseAttemptsOrRemove(itemsFromSource);
}

export async function updateCacheWithDecryptedContent(
  envelope: Pick<EnvelopePlus, 'id' | 'senderIdentity' | 'source'>,
  plaintext: ArrayBuffer
): Promise<void> {
  const { id, senderIdentity, source } = envelope;
  const item = await Data.getUnprocessedById(id);
  if (!item) {
    window?.log?.error(
      `updateCacheWithDecryptedContent: Didn't find item ${id} in cache to update`
    );
    return;
  }

  item.source = source;

  // For medium-size closed groups
  if (envelope.senderIdentity) {
    item.senderIdentity = senderIdentity;
  }

  item.decrypted = StringUtils.decode(plaintext, 'base64');

  await Data.updateUnprocessedWithData(item.id, item);
}
