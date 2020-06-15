import { EnvelopePlus } from './types';

export function removeFromCache(envelope: EnvelopePlus) {
  const { id } = envelope;

  return window.textsecure.storage.unprocessed.remove(id);
}
