import * as _ from 'lodash';
import * as UserUtils from '../../util/user';
import {
  getAllConversations,
  getPrimaryDeviceFor,
} from '../../../js/modules/data';
import { ConversationController, Whisper } from '../../window';

import { ContentMessage, SyncMessage } from '../messages/outgoing';

export function from(message: ContentMessage): SyncMessage | undefined {
  // const { timestamp, identifier } = message;

  // Stubbed for now
  return undefined;
}

export async function canSync(message: ContentMessage): Promise<boolean> {
  // This function should be agnostic to the device; it shouldn't need
  // to know about the recipient

  // Stubbed for now
  return Boolean(from(message));
}

export async function getSyncContacts(): Promise<Array<any> | undefined> {
  const thisDevice = await UserUtils.getCurrentDevicePubKey();

  if (!thisDevice) {
    return [];
  }

  const primaryDevice = await getPrimaryDeviceFor(thisDevice);
  const conversations = await getAllConversations({
    ConversationCollection: Whisper.ConversationCollection,
  });

  // We are building a set of all contacts
  const primaryContacts =
    conversations.filter(
      c =>
        c.isPrivate() &&
        !c.isOurLocalDevice() &&
        c.isFriend() &&
        !c.attributes.secondaryStatus
    ) || [];

  const secondaryContactsPartial = conversations.filter(
    c =>
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
  return _.uniqBy(
    [...primaryContacts, ...secondaryContacts],
    device => !!device
  );
}
