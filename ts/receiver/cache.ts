import { EnvelopePlus } from './types';
import { StringUtils } from '../session/utils';
import _ from 'lodash';
import {
  getAllUnprocessed,
  getUnprocessedById,
  getUnprocessedCount,
  removeAllUnprocessed,
  removeUnprocessed,
  saveUnprocessed,
  updateUnprocessedAttempts,
  updateUnprocessedWithData,
} from '../data/data';

export async function removeFromCache(envelope: EnvelopePlus) {
  const { id } = envelope;
  window.log.info(`removing from cache envelope: ${id}`);

  return removeUnprocessed(id);
}

export async function addToCache(
  envelope: EnvelopePlus,
  plaintext: ArrayBuffer
) {
  const { id } = envelope;

  const encodedEnvelope = StringUtils.decode(plaintext, 'base64');
  const data: any = {
    id,
    version: 2,
    envelope: encodedEnvelope,
    timestamp: Date.now(),
    attempts: 1,
  };

  if (envelope.senderIdentity) {
    data.senderIdentity = envelope.senderIdentity;
  }
  return saveUnprocessed(data, { forceSave: true });
}

async function fetchAllFromCache(): Promise<Array<any>> {
  const count = await getUnprocessedCount();

  if (count > 1500) {
    await removeAllUnprocessed();
    window.log.warn(
      `There were ${count} messages in cache. Deleted all instead of reprocessing`
    );
    return [];
  }

  const items = await getAllUnprocessed();
  return items;
}

export async function getAllFromCache() {
  window.log.info('getAllFromCache');
  const items = await fetchAllFromCache();

  window.log.info('getAllFromCache loaded', items.length, 'saved envelopes');

  return Promise.all(
    _.map(items, async (item: any) => {
      const attempts = _.toNumber(item.attempts || 0) + 1;

      try {
        if (attempts >= 10) {
          window.log.warn(
            'getAllFromCache final attempt for envelope',
            item.id
          );
          await removeUnprocessed(item.id);
        } else {
          await updateUnprocessedAttempts(item.id, attempts);
        }
      } catch (error) {
        window.log.error(
          'getAllFromCache error updating item after load:',
          error && error.stack ? error.stack : error
        );
      }

      return item;
    })
  );
}

export async function getAllFromCacheForSource(source: string) {
  const items = await fetchAllFromCache();

  // keep items without source too (for old message already added to the cache)
  const itemsFromSource = items.filter(
    item => !!item.senderIdentity || item.senderIdentity === source
  );

  window.log.info(
    'getAllFromCacheForSource loaded',
    itemsFromSource.length,
    'saved envelopes'
  );

  return Promise.all(
    _.map(items, async (item: any) => {
      const attempts = _.toNumber(item.attempts || 0) + 1;

      try {
        if (attempts >= 10) {
          window.log.warn(
            'getAllFromCache final attempt for envelope',
            item.id
          );
          await removeUnprocessed(item.id);
        } else {
          await updateUnprocessedAttempts(item.id, attempts);
        }
      } catch (error) {
        window.log.error(
          'getAllFromCache error updating item after load:',
          error && error.stack ? error.stack : error
        );
      }

      return item;
    })
  );
}

export async function updateCache(
  envelope: EnvelopePlus,
  plaintext: ArrayBuffer
): Promise<void> {
  const { id } = envelope;
  const item = await getUnprocessedById(id);
  if (!item) {
    window.log.error(`updateCache: Didn't find item ${id} in cache to update`);
    return;
  }

  item.source = envelope.source;

  // For medium-size closed groups
  if (envelope.senderIdentity) {
    item.senderIdentity = envelope.senderIdentity;
  }

  item.decrypted = StringUtils.decode(plaintext, 'base64');

  return updateUnprocessedWithData(item.id, item);
}
