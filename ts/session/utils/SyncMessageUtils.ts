import {
  ContactSyncMessage,
  ContentMessage,
  SyncMessageEnum,
} from '../messages/outgoing';
import { PubKey } from '../types';

import * as _ from 'lodash';
import * as Data from '../../../js/modules/data';
import { ConversationController, textsecure, Whisper } from '../../window';
import { OpenGroup } from '../types/OpenGroup';


export async function from(
  message: ContentMessage,
  sendTo: PubKey | OpenGroup,
  syncType: SyncMessageEnum.CONTACTS | SyncMessageEnum.GROUPS = SyncMessageEnum.CONTACTS
): Promise<ContactSyncMessage> {
  const { timestamp, identifier } = message;

  // Stubbed for now
  return new ContactSyncMessage({
    timestamp,
    identifier,
    contacts: [],
  });
}

export async function canSync(message: ContentMessage): Promise<boolean> {
  // This function should be agnostic to the device; it shouldn't need
  // to know about the recipient
  // return Boolean(from(message, device));
  // Stubbed for now
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
