import { EnvelopePlus } from '../../../receiver/types';
import { SignalService } from '../../../protobuf';

import uuid from 'uuid';

export function generateEnvelopePlusClosedGroup(groupId: string, sender: string): EnvelopePlus {
  const envelope: EnvelopePlus = {
    senderIdentity: sender,
    receivedAt: Date.now(),
    timestamp: Date.now() - 2000,
    id: uuid(),
    type: SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE,
    source: groupId,
    content: new Uint8Array(),
    toJSON: () => ['fake'],
  };

  return envelope;
}

export function generateEnvelopePlus(sender: string): EnvelopePlus {
  const envelope: EnvelopePlus = {
    receivedAt: Date.now(),
    timestamp: Date.now() - 2000,
    id: uuid(),
    type: SignalService.Envelope.Type.SESSION_MESSAGE,
    source: sender,
    senderIdentity: sender,
    content: new Uint8Array(),
    toJSON: () => ['fake'],
  };

  return envelope;
}
