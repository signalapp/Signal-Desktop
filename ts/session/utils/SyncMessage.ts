import * as _ from 'lodash';
import { UserUtil } from '../../util';
import { getAllConversations } from '../../../js/modules/data';
import { MultiDeviceProtocol } from '../protocols';
import ByteBuffer from 'bytebuffer';
import {
  ContentMessage,
  DataMessage,
  SentSyncMessage,
} from '../messages/outgoing';
import { PubKey } from '../types';
import { ConversationController } from '../conversations';

export function getSentSyncMessage(params: {
  message: ContentMessage;
  expirationStartTimestamp?: number;
  sentTo?: Array<PubKey>;
  destination: PubKey | string;
}): SentSyncMessage | undefined {
  if (!(params.message instanceof DataMessage)) {
    return undefined;
  }

  const pubKey = PubKey.cast(params.destination);
  return new SentSyncMessage({
    timestamp: Date.now(),
    identifier: params.message.identifier,
    destination: pubKey,
    dataMessage: params.message.dataProto(),
    expirationStartTimestamp: params.expirationStartTimestamp,
    sentTo: params.sentTo,
  });
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
        !c.attributes.secondaryStatus &&
        !!c.get('active_at')
    ) || [];

  const secondaryContactsPartial = conversations.filter(
    c =>
      c.isPrivate() &&
      !c.isOurLocalDevice() &&
      !c.isBlocked() &&
      c.attributes.secondaryStatus &&
      !!c.get('active_at')
  );

  const secondaryContactsPromise = secondaryContactsPartial.map(async c =>
    ConversationController.getInstance().getOrCreateAndWait(
      c.getPrimaryDevicePubKey(),
      'private'
    )
  );

  const secondaryContacts = (await Promise.all(secondaryContactsPromise))
    // Filter out our primary key if it was added here
    .filter(c => c.id !== primaryDevice.key);

  // Return unique contacts
  return _.uniqBy([...primaryContacts, ...secondaryContacts], 'id');
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
