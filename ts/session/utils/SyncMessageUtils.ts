import * as _ from 'lodash';
import { UserUtil } from '../../util/';
import { getAllConversations } from '../../../js/modules/data';
import { ContentMessage, SyncMessage } from '../messages/outgoing';
import { MultiDeviceProtocol } from '../protocols';
import ByteBuffer from 'bytebuffer';

export function from(message: ContentMessage): SyncMessage | undefined {
  if (message instanceof SyncMessage) {
    return message;
  }

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

  const secondaryContactsPromise = secondaryContactsPartial.map(async c =>
    window.ConversationController.getOrCreateAndWait(
      c.getPrimaryDevicePubKey(),
      'private'
    )
  );

  const secondaryContacts = (await Promise.all(secondaryContactsPromise))
    // Filter out our primary key if it was added here
    .filter(c => c.id !== primaryDevice.key);

  // Return unique contacts
  return _.uniqBy(
    [...primaryContacts, ...secondaryContacts],
    device => !!device
  );
}

export async function filterOpenGroupsConvos(
  conversations: Array<any>
): Promise<Array<any> | undefined> {
  // If we haven't got a primaryDeviceKey then we are in the middle of pairing
  // primaryDevicePubKey is set to our own number if we are the master device
  const thisDevice = await UserUtil.getCurrentDevicePubKey();

  if (!thisDevice) {
    return [];
  }

  // We only want to sync across open groups that we haven't left
  return conversations.filter(
    c => c.isPublic() && !c.isRss() && !c.get('left')
  );
}

// Serialise as <Element0.length><Element0><Element1.length><Element1>...
// This is an implementation of the reciprocal of contacts_parser.js
export function serialiseByteBuffers(buffers: Array<Uint8Array>): ByteBuffer {
  const result = new ByteBuffer();
  buffers.forEach(buffer => {
    // bytebuffer container expands and increments
    // offset automatically
    result.writeInt32(buffer.length);
    result.append(buffer);
  });
  result.limit = result.offset;
  result.reset();
  return result;
}
