import { toNumber } from 'lodash';
import { EnvelopePlus } from './types';

export function getEnvelopeId(envelope: EnvelopePlus) {
  if (envelope.source) {
    return `${envelope.source} ${toNumber(envelope.timestamp)} (${envelope.id})`;
  }

  return envelope.id;
}
