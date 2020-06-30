import { toNumber } from 'lodash';
import { EnvelopePlus } from './types';

export function getEnvelopeId(envelope: EnvelopePlus) {
  if (envelope.source) {
    return `${envelope.source}.${envelope.sourceDevice} ${toNumber(
      envelope.timestamp
    )} (${envelope.id})`;
  }

  return envelope.id;
}

export enum ConversationType {
  GROUP = 'group',
  PRIVATE = 'private',
}
