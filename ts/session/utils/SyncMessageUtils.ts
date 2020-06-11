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

import * as _ from 'lodash';
import * as Data from '../../../js/modules/data';
import { ConversationController, libloki, textsecure, Whisper } from '../../window';
import { OpenGroup } from '../types/OpenGroup';
import { generateFakePubkey } from '../../test/test-utils/testUtils';


export async function from(
  message: ContentMessage,
  sendTo: PubKey | OpenGroup,
  syncType: SyncMessageEnum.CONTACTS | SyncMessageEnum.GROUPS = SyncMessageEnum.CONTACTS
): Promise<ContactSyncMessage> {
  const { timestamp, identifier } = message;

  // Detect Sync Message Type
  const plainText = message.plainTextBuffer();
  const decoded = SignalService.Content.decode(plainText);

  let syncMessage: SyncMessage;
  switch (syncType) {
    case SyncMessageEnum.CONTACTS:
      // Send to one device at a time
      const contact = ConversationController.get(
        sendTo instanceof PubKey
        ? sendTo.key : sendTo.conversationId
      );

      const protoSyncMessage = libloki.api.createContactSyncProtoMessage(contact);
      
      const contentMessage = new ContactSyncMessage({
        timestamp,
        identifier,
        dataMessage: protoSyncMessage,
        linkedDevices: [],
      });
      
      break;

      
    case SyncMessageEnum.GROUPS:

      syncMessage = new GroupSyncMessage({

      });
      break;
    default:
  }

  return syncMessage;
}

export async function canSync(message: ContentMessage): Promise<boolean> {
  // This function should be agnostic to the device; it shouldn't need
  // to know about the recipient
  // return Boolean(from(message, device));
  return true;
}

export async function getSyncContacts(): Promise<Array<any>> {
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

  // Return unique contacts
  return _.uniqBy([
    ...primaryContacts,
    ...secondaryContacts,
  ], device => !!device);
}

export async function getOurPairedDevices(): Promise<Array<PubKey>> {
  const ourPubKey = textsecure.storage.user.getNumber();
  const ourDevices = await Data.getPairedDevicesFor(ourPubKey);

  return ourDevices.map(device => new PubKey(device));
}
