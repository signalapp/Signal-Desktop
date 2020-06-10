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

import * as Data from '../../../js/modules/data';
import { textsecure, libloki, ConversationController, Whisper } from '../../window';

// export function from(message: ContentMessage): SyncMessage | undefined {
// testtttingggg
export async function from(
  message: ContentMessage,
  sendTo: any,
  syncType: SyncMessageEnum.CONTACTS | SyncMessageEnum.GROUPS = SyncMessageEnum.CONTACTS
): Promise<SyncMessageType> {
  const { timestamp, identifier } = message;

  // Detect Sync Message Type
  const plainText = message.plainTextBuffer();
  const decoded = SignalService.Content.decode(plainText);

  let syncMessage: SyncMessage;
  switch (syncType) {
    case SyncMessageEnum.CONTACTS:
      
      // Send to one device at a time

      const builtSyncMessage = await libloki.api.createContactSyncProtoMessage();



      break;
    case SyncMessageEnum.GROUPS:

      syncMessage = new GroupSyncMessage({

      });
      break;
    default:
  }

  return syncMessage;
}

export async function canSync(message: ContentMessage, device: any): boolean {
  return Boolean(from(message, device));
}


export async function getSyncContacts(): Promise<Set<any>> {
  const thisDevice = textsecure.storage.user.getNumber();
  const primaryDevice = await Data.getPrimaryDeviceFor(thisDevice);
  const conversations = await Data.getAllConversations({ ConversationCollection: Whisper.ConversationCollection });

  // We are building a set of all contacts
  const primaryContacts = conversations.filter(c =>
    c.isPrivate() &&
    !c.isOurLocalDevice() &&
    c.isFriend() &&
    !c.attributes.secondaryStatus
  ) || [];

  const secondaryContactsPartial = conversations.filter(c =>
      c.isPrivate() &&
      !c.isOurLocalDevice() &&
      c.isFriend() &&
      c.attributes.secondaryStatus
  );

  const seondaryContactsPromise = secondaryContactsPartial.map(async c =>
    ConversationController.getOrCreateAndWait(
      c.getPrimaryDevicePubKey(),
      'private'
    )
  );

  const secondaryContacts = (await Promise.all(seondaryContactsPromise))
    // Filter out our primary key if it was added here
    .filter(c => c.id !== primaryDevice);

  return new Set([
    ...primaryContacts,
    ...secondaryContacts,
  ]);
}
