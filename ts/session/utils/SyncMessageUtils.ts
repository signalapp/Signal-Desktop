import * as _ from 'lodash';
import { UserUtil } from '../../util/';
import { getAllConversations } from '../../../js/modules/data';
import {
  ClosedGroupChatMessage,
  ClosedGroupMessage,
  ClosedGroupRequestInfoMessage,
  ContentMessage,
  ReadReceiptMessage,
  SentSyncMessage,
  SyncMessage,
  SyncReadMessage,
} from '../messages/outgoing';
import { MultiDeviceProtocol } from '../protocols';
import ByteBuffer from 'bytebuffer';
import { PubKey } from '../types';
import { SignalService } from '../../protobuf';

export function from(
  message: ContentMessage,
  destination: string | PubKey
): SyncMessage | undefined {
  if (message instanceof SyncMessage) {
    return message;
  }

  if (message instanceof ClosedGroupMessage) {
    return fromClosedGroupMessage(message);
  }

  if (message instanceof ReadReceiptMessage) {
    const pubKey = PubKey.cast(destination);
    const read = message.timestamps.map(timestamp => ({
      sender: pubKey.key,
      timestamp,
    }));

    return new SyncReadMessage({
      timestamp: Date.now(),
      readMessages: read,
    });
  }

  return undefined;
}

export function fromClosedGroupMessage(
  message: ClosedGroupMessage
): SyncMessage | undefined {
  // Sync messages for ClosedGroupChatMessage need to be built manually
  // This is because it needs the `expireStartTimestamp` field.
  if (
    message instanceof ClosedGroupRequestInfoMessage ||
    message instanceof ClosedGroupChatMessage
  ) {
    return undefined;
  }

  const pubKey = PubKey.cast(message.groupId);
  const content = SignalService.Content.decode(message.plainTextBuffer());
  if (!content.dataMessage) {
    return undefined;
  }

  return new SentSyncMessage({
    timestamp: message.timestamp,
    destination: pubKey,
    dataMessage: content.dataMessage,
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
