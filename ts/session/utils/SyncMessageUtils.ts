import { RawMessage } from '../types/RawMessage';
import { ContentMessage, SyncMessage } from '../messages/outgoing';
import { EncryptionType, PubKey } from '../types';

export function from(message: ContentMessage): SyncMessage | undefined {
  return new SyncMessage({})
}

export function canSync(message: ContentMessage): boolean {
  return Boolean(from(message));
}
