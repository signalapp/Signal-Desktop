import { RawMessage } from '../types/RawMessage';
import {
  ChatMessage,
  ContentMessage,
  SyncMessage,
  SyncMessageEnum,
  ContactSyncMessage,
} from '../messages/outgoing';
import { EncryptionType, PubKey } from '../types';
import { SignalService } from '../../protobuf';
import { SyncMessageType } from '../messages/outgoing/content/sync/SyncMessage';

// export function from(message: ContentMessage): SyncMessage | undefined {
// testtttingggg
export function from(
  message: ContentMessage,
  syncType: SyncMessageEnum = SyncMessageEnum.CONTACTS
): SyncMessageType {
  // Detect Sync Message Type
  const plainText = message.plainTextBuffer();
  const decoded = SignalService.Content.decode(plainText);

  console.log('[vince] decoded:', decoded);

  let syncMessage: SyncMessage;

  switch (syncType) {
    case SyncMessageEnum.CONTACTS:
      syncMessage = new ContactSyncMessage({});
      break;
  }

  return syncMessage;
}

export function canSync(message: ContentMessage): boolean {
  return Boolean(from(message));
}
