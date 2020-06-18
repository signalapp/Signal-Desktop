import * as _ from 'lodash';
import { UserUtil } from '../../util/';
import { getAllConversations } from '../../../js/modules/data';
import { ContentMessage, SyncMessage } from '../messages/outgoing';
import { MultiDeviceProtocol } from '../protocols';

export function from(message: ContentMessage): SyncMessage | undefined {
  // const { timestamp, identifier } = message;

  // Stubbed for now
  return undefined;
}

export function canSync(message: ContentMessage): boolean {
  // This function should be agnostic to the device; it shouldn't need
  // to know about the recipient

  // Stubbed for now
  return Boolean(from(message));
}

export async function getSyncContacts(): Promise<Array<any> | undefined> {
  const thisDevice = await UserUtil.getCurrentDevicePubKey();

  if (!thisDevice) {
    return [];
  }

  const primaryDevice = await MultiDeviceProtocol.getPrimaryDevice(thisDevice);
  const conversations = await getAllConversations({
    ConversationCollection: window.Whisper.ConversationCollection,
  });

  // We are building a set of all contacts
  const primaryContacts =
    conversations.filter(
      c =>
        c.isPrivate() &&
        !c.isOurLocalDevice() &&
        !c.isBlocked() &&
        !c.attributes.secondaryStatus
    ) || [];

  const secondaryContactsPartial = conversations.filter(
    c =>
      c.isPrivate() &&
      !c.isOurLocalDevice() &&
      !c.isBlocked() &&
      c.attributes.secondaryStatus
  );

  const seondaryContactsPromise = secondaryContactsPartial.map(async c =>
    window.ConversationController.getOrCreateAndWait(
      c.getPrimaryDevicePubKey(),
      'private'
    )
  );

  const secondaryContacts = (await Promise.all(seondaryContactsPromise))
    // Filter out our primary key if it was added here
    .filter(c => c.id !== primaryDevice.key);

  // Return unique contacts
  return _.uniqBy(
    [...primaryContacts, ...secondaryContacts],
    device => !!device
  );
}
